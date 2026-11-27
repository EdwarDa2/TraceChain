import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { URL } from 'node:url';
import { log } from 'node:console';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import argon2 from 'argon2';
import supertest from 'supertest';
import neo4j from 'neo4j-driver';
import { MongoClient } from 'mongodb';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

test('HTTP real autenticado: recepción, producción, distribución e idempotencia', async () => {
  for (const name of ['DATABASE_URL', 'MONGODB_URI', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    assert.ok(process.env[name]);
  }
  const originalUrl = process.env.DATABASE_URL;
  const originalWorker = process.env.OUTBOX_ENABLED;
  const originalMongoDatabase = process.env.MONGODB_DATABASE;
  const schema = `operations_http_${randomUUID().replaceAll('-', '')}`;
  const mongoDatabase = `tracechain_http_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: originalUrl });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: originalUrl, options: `-c search_path=${schema}` });
  const ids = { actor: randomUUID(), analyst: randomUUID(), supplier: randomUUID(),
    rawProduct: randomUUID(), finishedProduct: randomUUID(), plant: randomUUID(), branch: randomUUID() };
  const mongo = new MongoClient(process.env.MONGODB_URI);
  let app;
  let graph;
  const graphIds = new Set([ids.supplier, ids.rawProduct, ids.finishedProduct, ids.plant, ids.branch]);
  try {
    for (const version of ['001_catalogs', '002_inventory', '003_production',
      '004_distribution', '005_incidents', '006_integration', '007_views_indexes', '008_operation_codes']) {
      await pool.query(await readFile(
        new URL(`../../database/relational/schema/${version}.sql`, import.meta.url), 'utf8'));
    }
    const hash = await argon2.hash('prueba-operador-ficticio', { type: argon2.argon2id });
    await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol) VALUES
      ($1,'Operador ficticio','op-http@example.invalid',$3,'OPERADOR'),
      ($2,'Analista ficticio','qa-http@example.invalid',$3,'ANALISTA_CALIDAD')`,
    [ids.actor, ids.analyst, hash]);
    await pool.query(`INSERT INTO proveedores(id,codigo,nombre) VALUES($1,'PROV-HTTP','Proveedor ficticio')`, [ids.supplier]);
    await pool.query(`INSERT INTO productos(id,codigo,nombre,tipo,unidad_medida) VALUES
      ($1,'RAW-HTTP','Materia prima ficticia','MATERIA_PRIMA','KG'),
      ($2,'FIN-HTTP','Producto ficticio','TERMINADO','UNIDAD')`, [ids.rawProduct, ids.finishedProduct]);
    await pool.query(`INSERT INTO ubicaciones(id,codigo,nombre,tipo) VALUES
      ($1,'UB-HTTP','Planta ficticia','PLANTA_PRODUCCION'),
      ($2,'SUC-HTTP','Sucursal ficticia','SUCURSAL')`, [ids.plant, ids.branch]);
    const url = new URL(originalUrl);
    url.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = url.toString();
    process.env.OUTBOX_ENABLED = 'false';
    process.env.JWT_SECRET = 'clave-aleatoria-ficticia-para-pruebas-de-integracion-12345';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
    process.env.MONGODB_DATABASE = mongoDatabase;
    await mongo.connect();
    const db = mongo.db(mongoDatabase);
    for (const [name, file] of [
      ['plantillas_inspeccion', 'plantillas-inspeccion'],
      ['inspecciones_calidad', 'inspecciones-calidad'],
      ['expedientes_incidencias', 'expedientes-incidencias'],
    ]) {
      const validator = JSON.parse(await readFile(
        new URL(`../../database/document/validators/${file}.schema.json`, import.meta.url), 'utf8'));
      await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
    }
    await db.collection('inspecciones_calidad').createIndex(
      { inspector_id: 1, idempotency_key: 1 }, { unique: true });
    await db.collection('expedientes_incidencias').createIndex({ incidencia_id: 1 }, { unique: true });
    const templateId = randomUUID();
    await db.collection('plantillas_inspeccion').insertOne({
      _id: templateId, codigo: 'TPL-GENERAL-HTTP', nombre: 'Plantilla ficticia',
      producto_id: null, version: 1, activo: true, created_at: new Date(),
      parametros: [{ key: 'apariencia', label: 'Apariencia', dataType: 'TEXTO',
        unit: null, required: true, options: [], min: null, max: null }],
    });
    const { AppModule } = await import('../../backend/dist/app.module.js');
    const { createOutboxWriter } = await import('../../backend/dist/database/postgres/transaction.mjs');
    const { dispatchNext } = await import('../../backend/dist/integration/outbox/dispatcher.mjs');
    const { applyGraphEvent } = await import('../../backend/dist/integration/handlers/neo4j/projection.mjs');
    const { applyDossierEvent } = await import('../../backend/dist/integration/handlers/mongodb/dossier-projection.mjs');
    const catalog = [
      ['PROVEEDOR_CREADO', 'SUPPLIER', ids.supplier, { supplier: {
        id: ids.supplier, code: 'PROV-HTTP', name: 'Proveedor ficticio', active: true } }],
      ['PRODUCTO_CREADO', 'PRODUCT', ids.rawProduct, { product: {
        id: ids.rawProduct, code: 'RAW-HTTP', name: 'Materia prima ficticia',
        active: true, type: 'MATERIA_PRIMA', unit: 'KG' } }],
      ['PRODUCTO_CREADO', 'PRODUCT', ids.finishedProduct, { product: {
        id: ids.finishedProduct, code: 'FIN-HTTP', name: 'Producto ficticio',
        active: true, type: 'TERMINADO', unit: 'UNIDAD' } }],
      ['UBICACION_CREADA', 'LOCATION', ids.plant, { location: {
        id: ids.plant, code: 'UB-HTTP', name: 'Planta ficticia',
        active: true, type: 'PLANTA_PRODUCCION' } }],
      ['UBICACION_CREADA', 'LOCATION', ids.branch, { location: {
        id: ids.branch, code: 'SUC-HTTP', name: 'Sucursal ficticia',
        active: true, type: 'SUCURSAL' } }],
    ];
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      for (const [eventType, entityType, entityId, payload] of catalog) {
        await createOutboxWriter().enqueue({
          eventId: randomUUID(), eventType, entityType, entityId, destination: 'NEO4J', payload,
        }, tx);
      }
      await tx.query('COMMIT');
    } catch (error) {
      await tx.query('ROLLBACK');
      throw error;
    } finally {
      tx.release();
    }
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = supertest(app.getHttpServer());
    const response = await http.post('/api/v1/auth/login').send({
      email: 'op-http@example.invalid', password: 'prueba-operador-ficticio',
    });
    assert.equal(response.status, 200);
    const token = response.body.data.accessToken;
    assert.equal(typeof token, 'string');
    assert.equal((await http.post('/api/v1/lots/receipts').send({})).status, 401);
    const analyst = (await http.post('/api/v1/auth/login').send({
      email: 'qa-http@example.invalid', password: 'prueba-operador-ficticio',
    })).body.data.accessToken;
    assert.equal((await http.post('/api/v1/lots/receipts')
      .set('Authorization', `Bearer ${analyst}`).send({})).status, 403);
    const date = '2026-11-25T20:00:00Z';
    const receipt = { code: 'MP-HTTP', productId: ids.rawProduct, supplierId: ids.supplier,
      locationId: ids.plant, quantity: '10.000', receivedAt: date };
    const key = randomUUID();
    const createReceipt = () => http.post('/api/v1/lots/receipts')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send(receipt);
    const first = await createReceipt();
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.deepEqual((await createReceipt()).body, first.body);
    const conflict = await http.post('/api/v1/lots/receipts')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key)
      .send({ ...receipt, quantity: '9.000' });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.code, 'IDEMPOTENCY_CONFLICT');
    const product = await http.post('/api/v1/production-orders')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({ name: 'Producción ficticia', locationId: ids.plant,
        producedAt: '2026-11-25T20:01:00Z',
        inputs: [{ lotId: first.body.data.id, quantity: '4.000' }],
        outputs: [{ code: 'LP-HTTP', productId: ids.finishedProduct, quantity: '3.000' }] });
    assert.equal(product.status, 201, JSON.stringify(product.body));
    const output = (await pool.query("SELECT id FROM lotes WHERE codigo='LP-HTTP'")).rows[0].id;
    for (const id of [first.body.data.id, product.body.data.id, output]) graphIds.add(id);
    const distributed = await http.post('/api/v1/distributions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({ originLocationId: ids.plant, destinationLocationId: ids.branch,
        distributedAt: '2026-11-25T20:02:00Z', items: [{ lotId: output, quantity: '2.000' }] });
    assert.equal(distributed.status, 201, JSON.stringify(distributed.body));
    graphIds.add(distributed.body.data.id);
    const eventCount = (await pool.query('SELECT count(*)::int AS n FROM eventos_sincronizacion')).rows[0].n;
    assert.equal(eventCount, 8);
    assert.equal((await http.post('/api/v1/lots/receipts')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({ ...receipt, invalidProperty: true })).status, 400);
    graph = neo4j.driver(process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
    for (let i = 0; i < eventCount; i += 1) {
      assert.equal(await dispatchNext(pool, 'NEO4J',
        (event, signal) => applyGraphEvent(graph, process.env.NEO4J_DATABASE ?? 'neo4j', event, signal)), 'applied');
    }
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM eventos_sincronizacion
      WHERE estado='COMPLETADO'`)).rows[0].n, eventCount);
    const projection = await graph.executeQuery(`MATCH (a)-[r]->(b)
      WHERE a.id IN $ids AND b.id IN $ids RETURN count(r) AS n`,
    { ids: [...graphIds] }, { database: process.env.NEO4J_DATABASE ?? 'neo4j' });
    assert.equal(projection.records[0].get('n').toNumber(), 8);
    const traceBase = '/api/v1/traceability';
    const rootId = first.body.data.id;
    assert.equal((await http.get(`${traceBase}/${rootId}/forward`)).status, 401);
    const forward = await http.get(`${traceBase}/${rootId}/forward`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(forward.status, 200, JSON.stringify(forward.body));
    assert.equal(forward.body.data.status, 'COMPLETO');
    assert.deepEqual(forward.body.data.lots.map((item) => [item.code, item.depth]),
      [['LP-HTTP', 1]]);
    assert.equal(forward.body.data.destinations.length, 1);
    const backward = await http.get(`${traceBase}/${output}/backward`)
      .set('Authorization', `Bearer ${analyst}`);
    assert.equal(backward.status, 200, JSON.stringify(backward.body));
    assert.equal(backward.body.data.suppliers.length, 1);
    assert.deepEqual(backward.body.data.lots.map((item) => item.code), ['MP-HTTP']);
    const genealogy = await http.get(`${traceBase}/${output}/genealogy`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(genealogy.status, 200, JSON.stringify(genealogy.body));
    assert.deepEqual(genealogy.body.data.lots.map((item) => item.direction), ['BACKWARD']);
    const paths = await http.post(`${traceBase}/paths`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceLotId: rootId, targetLotId: output, mode: 'SHORTEST' });
    assert.equal(paths.status, 200, JSON.stringify(paths.body));
    assert.equal(paths.body.data.paths.length, 1);
    assert.equal(paths.body.data.paths[0].depth, 1);
    const common = await http.post(`${traceBase}/common-origins`)
      .set('Authorization', `Bearer ${analyst}`)
      .send({ lotIds: [rootId, output] });
    assert.equal(common.status, 200, JSON.stringify(common.body));
    assert.deepEqual(common.body.data.lots, []);
    assert.equal((await http.post(`${traceBase}/common-origins`)
      .set('Authorization', `Bearer ${token}`).send({ lotIds: [rootId, output] })).status, 403);
    assert.equal((await http.get(`${traceBase}/${rootId}/forward?maxDepth=21`)
      .set('Authorization', `Bearer ${token}`)).status, 400);
    assert.equal((await http.get(`${traceBase}/${randomUUID()}/forward`)
      .set('Authorization', `Bearer ${token}`)).status, 404);
    assert.equal((await http.post(`${traceBase}/paths`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceLotId: rootId, targetLotId: output, mode: 'INVALID' })).status, 400);
    const inspectionBody = { lotId: first.body.data.id, templateId, templateVersion: 1,
      inspectedAt: '2026-11-25T20:03:00Z', parameters: { apariencia: 'Observación ficticia' },
      result: 'NO_CONFORME', findings: [{ type: 'APARIENCIA', parameter: null,
        description: 'Hallazgo ficticio', severity: 'MEDIA' }], evidence: [] };
    const inspectionKey = randomUUID();
    const inspect = () => http.post('/api/v1/inspections')
      .set('Authorization', `Bearer ${analyst}`).set('Idempotency-Key', inspectionKey).send(inspectionBody);
    const inspection = await inspect();
    assert.equal(inspection.status, 201, JSON.stringify(inspection.body));
    assert.deepEqual((await inspect()).body, inspection.body);
    const invalidInspection = await http.post('/api/v1/inspections')
      .set('Authorization', `Bearer ${analyst}`).set('Idempotency-Key', randomUUID())
      .send({ ...inspectionBody, parameters: { otro: 'Sin plantilla' } });
    assert.equal(invalidInspection.status, 422);
    assert.equal(invalidInspection.body.error.code, 'INVALID_INSPECTION_PARAMETERS');
    assert.equal((await db.collection('inspecciones_calidad').countDocuments({})), 1);
    const incidentBody = { originLotId: first.body.data.id, title: 'Investigación ficticia',
      type: 'CALIDAD', severity: 'MEDIA', detectedAt: '2026-11-25T20:04:00Z',
      description: 'Expediente ficticio', inspectionIds: [inspection.body.data.id],
      findings: [], evidence: [] };
    const incidentKey = randomUUID();
    const createIncident = () => http.post('/api/v1/incidents')
      .set('Authorization', `Bearer ${analyst}`).set('Idempotency-Key', incidentKey).send(incidentBody);
    const incident = await createIncident();
    assert.equal(incident.status, 201, JSON.stringify(incident.body));
    assert.deepEqual((await createIncident()).body, incident.body);
    assert.equal(incident.body.data.dossierStatus, 'PENDIENTE');
    const impactUrl = `/api/v1/incidents/${incident.body.data.id}/impact`;
    assert.equal((await http.get(impactUrl)).status, 401);
    const pendingImpact = await http.get(impactUrl).set('Authorization', `Bearer ${token}`);
    assert.equal(pendingImpact.status, 200, JSON.stringify(pendingImpact.body));
    assert.equal(pendingImpact.body.data.status, 'PARCIAL');
    assert.equal(pendingImpact.body.data.quality.status, 'PARCIAL');
    assert.ok(pendingImpact.body.data.metadata.warnings.some((item) =>
      item.code === 'DOCUMENT_PENDING'));
    const invalidImpact = await http.get(`${impactUrl}?unknown=1`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(invalidImpact.status, 400);
    const startKey = randomUUID();
    const start = () => http.post(`/api/v1/incidents/${incident.body.data.id}/start-analysis`)
      .set('Authorization', `Bearer ${analyst}`).set('Idempotency-Key', startKey).send({});
    const started = await start();
    assert.equal(started.status, 200, JSON.stringify(started.body));
    assert.equal(started.body.data.status, 'EN_ANALISIS');
    assert.deepEqual((await start()).body, started.body);
    const closeBody = { resolution: 'Revisión ficticia concluida' };
    const closeKey = randomUUID();
    const close = () => http.post(`/api/v1/incidents/${incident.body.data.id}/close`)
      .set('Authorization', `Bearer ${analyst}`).set('Idempotency-Key', closeKey).send(closeBody);
    const pendingClose = await close();
    assert.equal(pendingClose.status, 409);
    assert.equal(pendingClose.body.error.code, 'DOSSIER_PENDING');
    assert.equal(await dispatchNext(pool, 'MONGODB',
      (event, signal) => applyDossierEvent(db, event, signal)), 'applied');
    const synchronized = (await pool.query('SELECT estado_expediente FROM incidencias WHERE id=$1',
      [incident.body.data.id])).rows[0].estado_expediente;
    assert.equal(synchronized, 'SINCRONIZADO');
    const dossier = await db.collection('expedientes_incidencias')
      .findOne({ incidencia_id: incident.body.data.id });
    assert.deepEqual(dossier.inspecciones_ids, [inspection.body.data.id]);
    assert.equal(dossier.version, 1);
    const completeImpact = await http.get(impactUrl).set('Authorization', `Bearer ${token}`);
    assert.equal(completeImpact.status, 200, JSON.stringify(completeImpact.body));
    assert.equal(completeImpact.body.data.status, 'COMPLETO');
    assert.deepEqual(completeImpact.body.data.summary, {
      originLots: 1, directLots: 1, indirectLots: 0, totalAffectedLots: 2,
      destinationCount: 1, blockedLots: 0,
    });
    assert.equal(completeImpact.body.data.quality.data.byLot.reduce((total, item) =>
      total + item.nonConforming, 0), 1);
    const blockBody = { lotIds: [first.body.data.id, output],
      reason: 'Verificación manual ficticia' };
    const blockKey = randomUUID();
    const block = () => http.post(`/api/v1/incidents/${incident.body.data.id}/blocks`)
      .set('Authorization', `Bearer ${analyst}`).set('Idempotency-Key', blockKey).send(blockBody);
    assert.equal((await http.post(`/api/v1/incidents/${incident.body.data.id}/blocks`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send(blockBody)).status, 403);
    const blocked = await block();
    assert.equal(blocked.status, 201, JSON.stringify(blocked.body));
    assert.equal(blocked.body.data.length, 2);
    assert.deepEqual((await block()).body, blocked.body);
    const restricted = await http.post('/api/v1/distributions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({ originLocationId: ids.plant, destinationLocationId: ids.branch,
        distributedAt: '2026-11-25T20:05:00Z', items: [{ lotId: output, quantity: '1.000' }] });
    assert.equal(restricted.status, 409, JSON.stringify(restricted.body));
    assert.equal(restricted.body.error.code, 'LOT_BLOCKED');
    const outputBlockId = blocked.body.data.find((item) => item.lotId === output).id;
    const releaseKey = randomUUID();
    const release = () => http.post(`/api/v1/lot-blocks/${outputBlockId}/release`)
      .set('Authorization', `Bearer ${analyst}`).set('Idempotency-Key', releaseKey)
      .send({ reason: 'Revisión ficticia finalizada' });
    const released = await release();
    assert.equal(released.status, 200, JSON.stringify(released.body));
    assert.equal(released.body.data.lotBlocked, false);
    assert.deepEqual((await release()).body, released.body);
    const closed = await close();
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(closed.body.data.status, 'CERRADA');
    assert.deepEqual((await close()).body, closed.body);
    const secondClose = await http.post(`/api/v1/incidents/${incident.body.data.id}/close`)
      .set('Authorization', `Bearer ${analyst}`).set('Idempotency-Key', randomUUID()).send(closeBody);
    assert.equal(secondClose.status, 409);
    assert.equal(secondClose.body.error.code, 'INCIDENT_CLOSED');
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM bloqueos_lotes
      WHERE incidencia_id=$1 AND activo=true`, [incident.body.data.id])).rows[0].n, 1);
    // Dos logins válidos anteriores también cuentan para 5 intentos/60 s por IP.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal((await http.post('/api/v1/auth/login').send({
        email: 'op-http@example.invalid', password: 'incorrecta',
      })).status, 401);
    }
    const limited = await http.post('/api/v1/auth/login').send({
      email: 'op-http@example.invalid', password: 'incorrecta',
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, 'RATE_LIMITED');
    assert.equal(limited.headers['retry-after'], '60');
    log(`OPERATIONS_HTTP_ACTUAL=${JSON.stringify({
      receipts: 1, productions: 1, distributions: 1,
      neoEvents: eventCount, projectedRelationships: 8,
      inspections: 1, incidents: 1, synchronizedDossiers: 1, replay: true,
    })}`);
  } finally {
    if (app) await app.close();
    if (graph) {
      await graph.executeQuery('MATCH (n) WHERE n.id IN $ids DETACH DELETE n',
        { ids: [...graphIds] }, { database: process.env.NEO4J_DATABASE ?? 'neo4j' });
      await graph.close();
    }
    process.env.DATABASE_URL = originalUrl;
    await mongo.db(mongoDatabase).dropDatabase();
    await mongo.close();
    if (originalMongoDatabase === undefined) delete process.env.MONGODB_DATABASE;
    else process.env.MONGODB_DATABASE = originalMongoDatabase;
    if (originalWorker === undefined) delete process.env.OUTBOX_ENABLED;
    else process.env.OUTBOX_ENABLED = originalWorker;
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
