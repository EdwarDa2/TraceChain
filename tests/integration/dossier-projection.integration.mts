import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import { applyDossierEvent } from '../../backend/src/integration/handlers/mongodb/dossier-projection.mts';
import type { Delivery } from '../../backend/src/integration/outbox/dispatcher.mts';

test('PM-12/15/16: Mongo crea expediente único, CAS y replay con validador', async () => {
  assert.ok(process.env.MONGODB_URI);
  const dbName = `tracechain_dossier_test_${randomUUID().replaceAll('-', '')}`;
  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);
  try {
    const validator = JSON.parse(await readFile(new URL('../../database/document/validators/expedientes-incidencias.schema.json',
      import.meta.url), 'utf8'));
    await db.createCollection('expedientes_incidencias', { validator, validationAction: 'error', validationLevel: 'strict' });
    await db.collection('expedientes_incidencias').createIndex({ incidencia_id: 1 }, { unique: true });
    const incidentId = randomUUID();
    const dossierId = randomUUID();
    const occurredAt = new Date().toISOString();
    const envelope = (eventType: Delivery['eventType'], payload: Record<string, unknown>): Delivery => ({
      eventId: randomUUID(), sequence: '1', eventType, entityType: 'INCIDENT',
      entityId: incidentId, destination: 'MONGODB', occurredAt, payloadVersion: 1, payload,
    });
    const created = envelope('INCIDENCIA_REGISTRADA', { incidentId, dossierId, version: 1,
      fields: { description: 'Investigación ficticia', inspectionIds: [], findings: [], evidence: [],
        notes: null, detailedResolution: null } });
    const signal = new AbortController().signal;
    await applyDossierEvent(db, created, signal);
    await applyDossierEvent(db, created, signal);
    const updated = envelope('EXPEDIENTE_ACTUALIZADO', { incidentId, expectedVersion: 1,
      nextVersion: 2, changes: { notes: 'Nota ficticia' } });
    await applyDossierEvent(db, updated, signal);
    await applyDossierEvent(db, updated, signal);
    assert.equal(await db.collection('expedientes_incidencias').countDocuments(), 1);
    const document = await db.collection('expedientes_incidencias').findOne({ incidencia_id: incidentId });
    assert.equal(document?.version, 2);
    assert.equal(document?.ultimo_evento_id, updated.eventId);
    assert.equal(document?.observaciones, 'Nota ficticia');
    const stale = envelope('EXPEDIENTE_ACTUALIZADO', { incidentId, expectedVersion: 1,
      nextVersion: 2, changes: { notes: 'No debe aplicarse' } });
    await assert.rejects(applyDossierEvent(db, stale, signal));
    assert.equal((await db.collection('expedientes_incidencias').findOne({ incidencia_id: incidentId }))?.observaciones,
      'Nota ficticia');
  } finally {
    // Base generada y poseída únicamente por esta prueba.
    await db.dropDatabase();
    await client.close();
  }
});
