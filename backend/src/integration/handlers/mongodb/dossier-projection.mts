import type { Db } from 'mongodb';
import { createMongoDossierStore } from '../../../database/mongodb/adapters.mts';
import {
  createDossierRepository, type DossierFields, type DossierPatch,
  type IncidenciaRegistradaEvent,
} from '../../../modules/incidents/dossier.mts';
import { PermanentDeliveryError, type Delivery } from '../../outbox/dispatcher.mts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new PermanentDeliveryError();
  return value as Record<string, unknown>;
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new PermanentDeliveryError();
  return value;
}
function fields(value: unknown): DossierFields {
  const input = object(value);
  if (typeof input.description !== 'string' || input.description.length === 0 ||
      input.description.length > 5000 || !Array.isArray(input.inspectionIds) ||
      input.inspectionIds.length > 50 || input.inspectionIds.some((value) => !UUID.test(value)) ||
      new Set(input.inspectionIds).size !== input.inspectionIds.length ||
      !Array.isArray(input.findings) || input.findings.length > 30 ||
      !Array.isArray(input.evidence) || input.evidence.length > 20 ||
      !(input.notes === null || typeof input.notes === 'string') ||
      !(input.detailedResolution === null || typeof input.detailedResolution === 'string')) {
    throw new PermanentDeliveryError();
  }
  // La validación de referencias SQL/Mongo ocurre antes de encolar (RN-116);
  // el handler comprueba la estructura y la versión antes de persistir.
  return input as unknown as DossierFields;
}

/** El repositorio implementa inserción única y actualización CAS del expediente. */
export async function applyDossierEvent(db: Db, event: Delivery, signal: AbortSignal) {
  if (event.destination !== 'MONGODB' || event.entityType !== 'INCIDENT' ||
      !['INCIDENCIA_REGISTRADA', 'EXPEDIENTE_ACTUALIZADO'].includes(event.eventType) ||
      event.payloadVersion !== 1) throw new PermanentDeliveryError();
  signal.throwIfAborted();
  const payload = object(event.payload);
  const incidentId = uuid(payload.incidentId);
  if (incidentId !== event.entityId) throw new PermanentDeliveryError();
  const repository = createDossierRepository(createMongoDossierStore(db));
  if (event.eventType === 'INCIDENCIA_REGISTRADA') {
    if (payload.version !== 1) throw new PermanentDeliveryError();
    const creation: IncidenciaRegistradaEvent = {
      eventId: uuid(event.eventId), eventType: 'INCIDENCIA_REGISTRADA',
      payloadVersion: 1, occurredAt: event.occurredAt,
      payload: { incidentId, dossierId: uuid(payload.dossierId), version: 1, fields: fields(payload.fields) },
    };
    const result = await repository.ensureCreated(creation, event.occurredAt);
    if (!result.ok) throw new PermanentDeliveryError();
  } else {
    const expected = payload.expectedVersion;
    if (typeof expected !== 'number' || !Number.isSafeInteger(expected) || expected < 1 ||
        payload.nextVersion !== expected + 1) throw new PermanentDeliveryError();
    const changes = object(payload.changes);
    if (Object.keys(changes).length === 0 ||
        Object.keys(changes).some((key) => !['description', 'inspectionIds', 'findings', 'evidence',
          'notes', 'detailedResolution'].includes(key))) throw new PermanentDeliveryError();
    const patch: DossierPatch = { ...changes, expectedVersion: expected };
    const result = await repository.update(incidentId, patch, uuid(event.eventId), event.occurredAt);
    if (!result.ok) throw new PermanentDeliveryError();
  }
  signal.throwIfAborted();
}
