import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { URL } from 'node:url';
import pg from 'pg';
import argon2 from 'argon2';
import supertest from 'supertest';
import neo4j from 'neo4j-driver';
import { MongoClient } from 'mongodb';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

const ENDPOINTS = [
  ['forward', 'GET', (ids) => `/api/v1/traceability/${ids.root}/forward`],
  ['backward', 'GET', (ids) => `/api/v1/traceability/${ids.output}/backward`],
  ['genealogy', 'GET', (ids) => `/api/v1/traceability/${ids.output}/genealogy`],
  ['common-origins', 'POST', (ids) => ['/api/v1/traceability/common-origins',
    { lotIds: [ids.root, ids.output] }]],
  ['paths', 'POST', (ids) => ['/api/v1/traceability/paths',
    { sourceLotId: ids.root, targetLotId: ids.output, mode: 'SHORTEST' }]],
  ['impact', 'GET', (ids) => `/api/v1/incidents/${ids.incident}/impact`],
];

function stats(values) {
  const ok = values.filter(Number.isFinite);
  if (ok.length === 0) return { mean: null, median: null, p95: null, stddev: null };
  const sorted = [...ok].sort((a, b) => a - b);
  const mean = ok.reduce((sum, value) => sum + value, 0) / ok.length;
  return {
    mean,
    median: sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)],
    stddev: Math.sqrt(ok.reduce((sum, value) => sum + (value - mean) ** 2, 0) / ok.length),
  };
}

test('latencia API real extremo a extremo separada del benchmark de motores', async () => {
  for (const name of ['DATABASE_URL', 'MONGODB_URI', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    assert.ok(process.env[name], `falta ${name}`);
  }
  const repetitions = Number(process.env.BENCH_REPS ?? 30);
  const warmups = Number(process.env.BENCH_WARMUPS ?? 5);
  const schema = `api_latency_${randomUUID().replaceAll('-', '')}`;
  const mongoDatabase = `tracechain_api_latency_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const originalUrl = process.env.DATABASE_URL;
  const originalMongo = process.env.MONGODB_DATABASE;
  const originalWorker = process.env.OUTBOX_ENABLED;
  const url = new URL(originalUrl);
  url.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  process.env.MONGODB_DATABASE = mongoDatabase;
  process.env.OUTBOX_ENABLED = 'false';
  process.env.JWT_SECRET = 'clave-ficticia-api-latency-para-pruebas-12345';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
  const graph = neo4j.driver(process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
  const mongo = new MongoClient(process.env.MONGODB_URI);
  const db = mongo.db(mongoDatabase);
  const graphIds = new Set();
  const ids = { operator: randomUUID(), analyst: randomUUID(), supplier: randomUUID(),
    raw: randomUUID(), finished: randomUUID(), plant: randomUUID(), branch: randomUUID() };
  let app;
  try {
    for (const version of ['001_catalogs', '002_inventory', '003_production',
      '004_distribution', '005_incidents', '006_integration', '007_views_indexes', '008_operation_codes']) {
      await pool.query(await readFile(
        new URL(`../../database/relational/schema/${version}.sql`, import.meta.url), 'utf8'));
    }
    const hash = await argon2.hash('prueba-api-latency', { type: argon2.argon2id });
    await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol) VALUES
      ($1,'Operador ficticio','op-latency@example.invalid',$3,'OPERADOR'),
      ($2,'Analista ficticio','qa-latency@example.invalid',$3,'ANALISTA_CALIDAD')`,
    [ids.operator, ids.analyst, hash]);
    await pool.query('INSERT INTO proveedores(id,codigo,nombre) VALUES($1,$2,$3)',
      [ids.supplier, 'PROV-LAT', 'Proveedor ficticio']);
    await pool.query(`INSERT INTO productos(id,codigo,nombre,tipo,unidad_medida) VALUES
      ($1,'RAW-LAT','Materia prima ficticia','MATERIA_PRIMA','KG'),
      ($2,'FIN-LAT','Producto ficticio','TERMINADO','UNIDAD')`, [ids.raw, ids.finished]);
    await pool.query(`INSERT INTO ubicaciones(id,codigo,nombre,tipo) VALUES
      ($1,'UB-LAT','Planta ficticia','PLANTA_PRODUCCION'),
      ($2,'SUC-LAT','Sucursal ficticia','SUCURSAL')`, [ids.plant, ids.branch]);
    for (const id of [ids.supplier, ids.raw, ids.finished, ids.plant, ids.branch]) graphIds.add(id);

    const { createSqlOperationsDeps } = await import('../../backend/dist/database/postgres/operations-repository.mjs');
    const { createOutboxWriter } = await import('../../backend/dist/database/postgres/transaction.mjs');
    const { registrarRecepcion, registrarProduccion, registrarDistribucion } =
      await import('../../backend/dist/modules/operations/operations.mjs');
    const { dispatchNext } = await import('../../backend/dist/integration/outbox/dispatcher.mjs');
    const { applyGraphEvent } = await import('../../backend/dist/integration/handlers/neo4j/projection.mjs');
    const { applyDossierEvent } = await import('../../backend/dist/integration/handlers/mongodb/dossier-projection.mjs');
    const { InspectionsService } = await import('../../backend/dist/modules/inspections/inspections.service.js');
    const { IncidentWriteService } = await import('../../backend/dist/modules/incidents/incident-write.service.js');

    const catalog = [
      ['PROVEEDOR_CREADO', 'SUPPLIER', ids.supplier, { supplier: {
        id: ids.supplier, code: 'PROV-LAT', name: 'Proveedor ficticio', active: true } }],
      ['PRODUCTO_CREADO', 'PRODUCT', ids.raw, { product: {
        id: ids.raw, code: 'RAW-LAT', name: 'Materia prima ficticia',
        active: true, type: 'MATERIA_PRIMA', unit: 'KG' } }],
      ['PRODUCTO_CREADO', 'PRODUCT', ids.finished, { product: {
        id: ids.finished, code: 'FIN-LAT', name: 'Producto ficticio',
        active: true, type: 'TERMINADO', unit: 'UNIDAD' } }],
      ['UBICACION_CREADA', 'LOCATION', ids.plant, { location: {
        id: ids.plant, code: 'UB-LAT', name: 'Planta ficticia',
        active: true, type: 'PLANTA_PRODUCCION' } }],
      ['UBICACION_CREADA', 'LOCATION', ids.branch, { location: {
        id: ids.branch, code: 'SUC-LAT', name: 'Sucursal ficticia',
        active: true, type: 'SUCURSAL' } }],
    ];
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      for (const [eventType, entityType, entityId, payload] of catalog) {
        await createOutboxWriter().enqueue({ eventId: randomUUID(), eventType, entityType,
          entityId, destination: 'NEO4J', payload }, tx);
      }
      await tx.query('COMMIT');
    } catch (error) {
      await tx.query('ROLLBACK');
      throw error;
    } finally {
      tx.release();
    }
    const deps = createSqlOperationsDeps(pool, () => '2026-11-25T21:00:00.000Z');
    const receipt = await registrarRecepcion({ code: 'MP-LAT', productId: ids.raw,
      supplierId: ids.supplier, locationId: ids.plant, quantity: '10.000',
      receivedAt: '2026-11-25T20:00:00Z', expirationDate: null,
      actorId: ids.operator, idempotencyKey: randomUUID() }, deps);
    const production = await registrarProduccion({ name: 'Producción ficticia',
      locationId: ids.plant, producedAt: '2026-11-25T20:01:00Z',
      inputs: [{ lotId: receipt.id, quantity: '4.000' }],
      outputs: [{ code: 'LP-LAT', productId: ids.finished, quantity: '3.000', expirationDate: null }],
      actorId: ids.operator, idempotencyKey: randomUUID() }, deps);
    const distribution = await registrarDistribucion({ originLocationId: ids.plant,
      destinationLocationId: ids.branch, distributedAt: '2026-11-25T20:02:00Z',
      items: [{ lotId: receipt.id, quantity: '1.000' }],
      actorId: ids.operator, idempotencyKey: randomUUID() }, deps);
    graphIds.add(receipt.id);
    graphIds.add(production.id);
    graphIds.add(distribution.id);
    const output = (await pool.query("SELECT id FROM lotes WHERE codigo='LP-LAT'")).rows[0].id;
    graphIds.add(output);
    const neoEvents = (await pool.query(`SELECT count(*)::int AS n FROM eventos_sincronizacion
      WHERE motor_destino='NEO4J'`)).rows[0].n;
    for (let i = 0; i < neoEvents; i += 1) {
      assert.equal(await dispatchNext(pool, 'NEO4J',
        (event, signal) => applyGraphEvent(graph, process.env.NEO4J_DATABASE ?? 'neo4j',
          event, signal)), 'applied');
    }
    await mongo.connect();
    for (const [name, file] of [
      ['plantillas_inspeccion', 'plantillas-inspeccion'],
      ['inspecciones_calidad', 'inspecciones-calidad'],
      ['expedientes_incidencias', 'expedientes-incidencias'],
    ]) {
      await db.createCollection(name, { validator: JSON.parse(await readFile(
        new URL(`../../database/document/validators/${file}.schema.json`, import.meta.url), 'utf8')),
      validationLevel: 'strict', validationAction: 'error' });
    }
    await db.collection('inspecciones_calidad').createIndex(
      { inspector_id: 1, idempotency_key: 1 }, { unique: true });
    await db.collection('expedientes_incidencias').createIndex({ incidencia_id: 1 }, { unique: true });
    const templateId = randomUUID();
    await db.collection('plantillas_inspeccion').insertOne({
      _id: templateId, codigo: 'TPL-GENERAL-LAT', nombre: 'Plantilla ficticia',
      producto_id: null, version: 1, activo: true, created_at: new Date(),
      parametros: [{ key: 'apariencia', label: 'Apariencia', dataType: 'TEXTO',
        unit: null, required: true, options: [], min: null, max: null }],
    });
    const inspectionService = new InspectionsService({ pool }, { db });
    const inspection = await inspectionService.create({ lotId: receipt.id,
      templateId, templateVersion: 1, inspectedAt: '2026-11-25T20:03:00Z',
      parameters: { apariencia: 'Observación ficticia' }, result: 'NO_CONFORME',
      findings: [{ type: 'APARIENCIA', parameter: null,
        description: 'Hallazgo ficticio', severity: 'MEDIA' }], evidence: [],
    }, ids.analyst, randomUUID());
    const incidentService = new IncidentWriteService({ pool }, { db });
    const incident = await incidentService.create({ originLotId: receipt.id,
      title: 'Investigación ficticia', type: 'CALIDAD', severity: 'MEDIA',
      detectedAt: '2026-11-25T20:04:00Z', description: 'Expediente ficticio',
      inspectionIds: [inspection.id], findings: [], evidence: [],
    }, ids.analyst, randomUUID());
    await incidentService.startAnalysis(incident.id, ids.analyst, randomUUID());
    const mongoEvents = (await pool.query(`SELECT count(*)::int AS n FROM eventos_sincronizacion
      WHERE motor_destino='MONGODB'`)).rows[0].n;
    for (let i = 0; i < mongoEvents; i += 1) {
      assert.equal(await dispatchNext(pool, 'MONGODB',
        (event, signal) => applyDossierEvent(db, event, signal)), 'applied');
    }

    const { AppModule } = await import('../../backend/dist/app.module.js');
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = supertest(app.getHttpServer());
    const login = async (email) => (await http.post('/api/v1/auth/login')
      .send({ email, password: 'prueba-api-latency' })).body.data.accessToken;
    const tokens = { operator: await login('op-latency@example.invalid'),
      analyst: await login('qa-latency@example.invalid') };
    assert.ok(tokens.operator && tokens.analyst);
    const idsForEndpoints = { root: receipt.id, output, incident: incident.id };
    const measurements = [];
    for (const [name, method, target] of ENDPOINTS) {
      const role = name === 'common-origins' ? tokens.analyst : tokens.operator;
      const call = () => {
        const value = target(idsForEndpoints);
        const path = Array.isArray(value) ? value[0] : value;
        const request = method === 'GET' ? http.get(path) : http.post(path);
        return request.set('Authorization', `Bearer ${role}`)
          .send(Array.isArray(value) ? value[1] : undefined);
      };
      for (let i = 0; i < warmups; i += 1) await call();
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        const started = performance.now();
        const response = await call();
        const durationMs = performance.now() - started;
        assert.equal(response.status, 200, `${name}: ${JSON.stringify(response.body)}`);
        measurements.push({ endpoint: name, method, path: Array.isArray(target(idsForEndpoints))
          ? target(idsForEndpoints)[0] : target(idsForEndpoints),
        repetition, durationMs, status: response.status });
      }
    }
    await mkdir(new URL('../../docs/pruebas/', import.meta.url), { recursive: true });
    const csv = ['endpoint,method,path,repetition,duration_ms,status',
      ...measurements.map((row) => [row.endpoint, row.method, row.path, row.repetition,
        row.durationMs.toFixed(3), row.status].join(','))].join('\n');
    await writeFile(new URL('../../docs/pruebas/api-latency-actual.csv', import.meta.url), csv);
    const summary = { fecha: new Date().toISOString(), repetitions, warmups,
      proposito: 'Latencia HTTP extremo a extremo; no comparable con las mediciones driver→motor.',
      entorno: { node: process.version,
        postgres: (await pool.query('SELECT version() AS v')).rows[0].v,
        neo4j: (await graph.executeQuery('CALL dbms.components() YIELD versions RETURN versions',
          {}, { database: process.env.NEO4J_DATABASE ?? 'neo4j' })).records[0].get('versions')[0] },
      endpoints: Object.fromEntries(ENDPOINTS.map(([name]) => [name,
        stats(measurements.filter((row) => row.endpoint === name).map((row) => row.durationMs))])),
    };
    await writeFile(new URL('../../docs/pruebas/api-latency-actual.json', import.meta.url),
      JSON.stringify(summary, null, 2));
    process.stdout.write(`API_LATENCY_ACTUAL=${JSON.stringify({
      endpoints: ENDPOINTS.length, repetitions, warmups,
      measurements: measurements.length, errors: measurements.filter((row) =>
        row.status !== 200).length,
      medians: Object.fromEntries(Object.entries(summary.endpoints).map(([key, value]) =>
        [key, Number(value.median?.toFixed(3))])),
    })}\n`);
  } finally {
    if (app) await app.close();
    await mongo.close();
    await graph.executeQuery('MATCH (n) WHERE n.id IN $ids DETACH DELETE n',
      { ids: [...graphIds] }, { database: process.env.NEO4J_DATABASE ?? 'neo4j' });
    await graph.close();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    process.env.DATABASE_URL = originalUrl;
    if (originalMongo === undefined) delete process.env.MONGODB_DATABASE;
    else process.env.MONGODB_DATABASE = originalMongo;
    if (originalWorker === undefined) delete process.env.OUTBOX_ENABLED;
    else process.env.OUTBOX_ENABLED = originalWorker;
  }
});
