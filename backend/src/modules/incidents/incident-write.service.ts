import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import neo4j, { type Driver } from 'neo4j-driver';
import type { Document } from 'mongodb';
import type { IncidentCreate } from '@tracechain/contracts';
import { SqlService } from '../../database/postgres/sql.service';
import { MongoService } from '../../database/mongodb/mongo.service';
import { createSqlOperationsDeps } from '../../database/postgres/operations-repository.mts';
import { createIncidentRepository } from '../../database/postgres/incident-repositories.mts';
import { createOutboxWriter, createIdempotencyStore } from '../../database/postgres/transaction.mts';
import { verifyDescendant } from '../../database/neo4j/verification.mts';
import { validateEnv } from '../../config/env.validation.mts';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

@Injectable()
export class IncidentWriteService {
  private readonly config = validateEnv(process.env);
  private readonly driver: Driver = neo4j.driver(this.config.NEO4J_URI,
    neo4j.auth.basic(this.config.NEO4J_USER, this.config.NEO4J_PASSWORD));
  constructor(private readonly sql: SqlService, private readonly mongo: MongoService) {}

  async create(input: IncidentCreate, actorId: string, key: string) {
    const ids = input.inspectionIds;
    if (!['CALIDAD', 'EMPAQUE', 'ALMACENAMIENTO', 'OTRO'].includes(input.type) ||
        !['BAJA', 'MEDIA', 'ALTA'].includes(input.severity) ||
        input.title.trim().length === 0 || input.title.length > 200 ||
        input.description.trim().length === 0 || input.description.length > 5000 ||
        ids.length > 50 || new Set(ids).size !== ids.length ||
        input.findings.length > 30 || input.evidence.length > 20 ||
        input.notes !== undefined && input.notes !== null && input.notes.length > 3000) {
        throw new Error('VALIDATION_ERROR');
    }
    for (const finding of input.findings) {
      if (!['IMPUREZAS', 'HUMEDAD', 'PESO', 'EMPAQUE', 'APARIENCIA', 'TEXTURA', 'TEMPERATURA', 'OTRO']
        .includes(finding.type) || !['BAJA', 'MEDIA', 'ALTA'].includes(finding.severity) ||
          finding.parameter !== null || typeof finding.description !== 'string' ||
          finding.description.length < 1 || finding.description.length > 5000) {
        throw new Error('VALIDATION_ERROR');
      }
    }
    for (const evidence of input.evidence) {
      if (!['IMAGEN', 'DOCUMENTO', 'REFERENCIA'].includes(evidence.type) ||
          typeof evidence.reference !== 'string' || evidence.reference.length < 1 ||
          evidence.reference.length > 500 ||
          evidence.description !== undefined && evidence.description !== null &&
            (typeof evidence.description !== 'string' || evidence.description.length > 5000)) {
        throw new Error('VALIDATION_ERROR');
      }
    }
    const hash = createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
    const request = { actorId, operacion: 'POST /incidents', clave: key, hash };
    const previous = (await this.sql.pool.query<{ request_hash: string; response_body: unknown }>(
      `SELECT request_hash,response_body FROM solicitudes_idempotentes
       WHERE usuario_id=$1 AND operacion=$2 AND clave=$3`, [actorId, request.operacion, key])).rows[0];
    if (previous) {
      if (previous.request_hash !== hash) throw new Error('IDEMPOTENCY_CONFLICT');
      return previous.response_body;
    }
    if (ids.length > 0) {
      // I/O documental/grafo fuera de la transacción SQL (RN-116, RN-120).
      const docs = await this.mongo.db.collection<Document & { _id: string }>('inspecciones_calidad')
        .find({ _id: { $in: ids } }).toArray();
      if (docs.length !== ids.length) throw new Error('INVALID_REFERENCE');
      for (const doc of docs) {
        if (doc.lote_id === input.originLotId) continue;
        const verdict = await verifyDescendant(this.sql.pool, this.driver,
          this.config.NEO4J_DATABASE, input.originLotId, String(doc.lote_id));
        if (verdict === 'NO') throw new Error('INVALID_REFERENCE');
        if (verdict === 'UNKNOWN') throw new Error('GRAPH_SYNC_PENDING');
      }
    }
    const transaction = createSqlOperationsDeps(this.sql.pool).transaction;
    const store = createIdempotencyStore();
    return transaction.run(async (tx) => {
      const reservation = await store.reserve(request, tx);
      if (reservation.replay) return reservation.body;
      const lot = (await tx.query('SELECT id,fecha_origen FROM lotes WHERE id=$1 FOR SHARE',
        [input.originLotId])).rows[0];
      if (!lot) throw new Error('RESOURCE_NOT_FOUND');
      const detectedAt = Date.parse(input.detectedAt);
      if (!Number.isFinite(detectedAt) || detectedAt < new Date(lot.fecha_origen as string).getTime() ||
          detectedAt > Date.now()) throw new Error('INVALID_OPERATION_DATE');
      const sequence = await tx.query("SELECT nextval('codigo_inc_seq') AS n");
      const id = randomUUID();
      const code = `INC-${String(sequence.rows[0]?.n).padStart(6, '0')}`;
      await createIncidentRepository().create({ id, code, originLotId: input.originLotId,
        title: input.title, type: input.type, severity: input.severity,
        detectedAt: input.detectedAt, reportedBy: actorId }, tx);
      const at = new Date().toISOString();
      await createOutboxWriter().enqueue({ eventId: randomUUID(), eventType: 'INCIDENCIA_REGISTRADA',
        entityType: 'INCIDENT', entityId: id, destination: 'MONGODB',
        payload: { incidentId: id, dossierId: randomUUID(), version: 1,
          fields: { description: input.description, inspectionIds: ids,
            findings: input.findings, evidence: input.evidence.map((e) => ({
              type: e.type, reference: e.reference, description: e.description ?? null, registeredAt: at,
            })), notes: input.notes ?? null, detailedResolution: null } },
      }, tx);
      const response = { id, code, status: 'ABIERTA' as const, dossierStatus: 'PENDIENTE' as const };
      await store.confirm(request, 201, response, tx);
      return response;
    });
  }

  async startAnalysis(id: string, actorId: string, key: string) {
    return this.transition(id, actorId, key, 'start-analysis');
  }

  async close(id: string, resolution: string, actorId: string, key: string) {
    if (typeof resolution !== 'string' || resolution.trim().length < 1 ||
        resolution.length > 5000) throw new Error('VALIDATION_ERROR');
    return this.transition(id, actorId, key, 'close', resolution);
  }

  private async transition(id: string, actorId: string, key: string,
    action: 'start-analysis' | 'close', resolution?: string) {
    const operation = `POST /incidents/:id/${action}`;
    const hash = createHash('sha256').update(JSON.stringify(canonical({
      pathParams: { id }, body: action === 'close' ? { resolution } : {},
    }))).digest('hex');
    const request = { actorId, operacion: operation, clave: key, hash };
    const store = createIdempotencyStore();
    const repository = createIncidentRepository();
    return createSqlOperationsDeps(this.sql.pool).transaction.run(async (tx) => {
      const reservation = await store.reserve(request, tx);
      if (reservation.replay) return reservation.body;
      const incident = await repository.lock(id, tx);
      if (!incident) throw new Error('RESOURCE_NOT_FOUND');
      if (incident.status === 'CERRADA') throw new Error('INCIDENT_CLOSED');
      if (incident.status !== (action === 'close' ? 'EN_ANALISIS' : 'ABIERTA')) {
        throw new Error('INVALID_INCIDENT_TRANSITION');
      }
      if (action === 'close') {
        if (incident.dossierStatus !== 'SINCRONIZADO' ||
            await repository.confirmedDossierVersion(id, tx) === null) {
          throw new Error('DOSSIER_PENDING');
        }
      }
      const updated = action === 'close'
        ? await repository.close(id, resolution!, actorId, tx)
        : await repository.startAnalysis(id, tx);
      if (!updated) throw new Error('INVALID_INCIDENT_TRANSITION');
      const response = {
        ...updated,
        detectedAt: new Date(updated.detectedAt).toISOString(),
        createdAt: new Date(updated.createdAt).toISOString(),
        updatedAt: new Date(updated.updatedAt).toISOString(),
        closedAt: updated.closedAt === null ? null : new Date(updated.closedAt).toISOString(),
      };
      await store.confirm(request, 200, response, tx);
      return response;
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }
}
