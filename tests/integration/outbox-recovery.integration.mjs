import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import pg from 'pg';
import neo4j from 'neo4j-driver';
import { MongoClient } from 'mongodb';
import { createSqlOperationsDeps } from '../../backend/dist/database/postgres/operations-repository.mjs';
import { registrarRecepcion } from '../../backend/dist/modules/operations/operations.mjs';
import { createOutboxWriter } from '../../backend/dist/database/postgres/transaction.mjs';
import { IncidentWriteService } from '../../backend/dist/modules/incidents/incident-write.service.js';
import { dispatchNext, PermanentDeliveryError } from '../../backend/dist/integration/outbox/dispatcher.mjs';
import { applyGraphEvent } from '../../backend/dist/integration/handlers/neo4j/projection.mjs';
import { applyDossierEvent } from '../../backend/dist/integration/handlers/mongodb/dossier-projection.mjs';

test('Outbox real: fallo transitorio, PROCESANDO residual, replay idempotente y fallo permanente', async () => {
  for (const name of ['DATABASE_URL', 'MONGODB_URI', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    assert.ok(process.env[name], `falta ${name}`);
  }
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
  process.env.JWT_SECRET = 'clave-ficticia-outbox-para-pruebas-12345';
  const schema = `recovery_test_${randomUUID().replaceAll('-', '')}`;
  const mongoDatabase = `tracechain_recovery_${randomUUID().replaceAll('-', '')}`;
  const graphDb = process.env.NEO4J_DATABASE ?? 'neo4j';
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`, max: 8 });
  const graph = neo4j.driver(process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
  const down = neo4j.driver('bolt://127.0.0.1:1', neo4j.auth.basic('x', 'y'),
    { connectionTimeout: 100, maxConnectionPoolSize: 1 });
  const mongo = new MongoClient(process.env.MONGODB_URI);
  let db;
  const ids = { operator: randomUUID(), analyst: randomUUID(), supplier: randomUUID(),
    product: randomUUID(), location: randomUUID() };
  const graphIds = new Set([ids.supplier, ids.product, ids.location]);
  let incidentService;
  try {
    for (const version of ['001_catalogs', '002_inventory', '003_production',
      '004_distribution', '005_incidents', '006_integration', '007_views_indexes', '008_operation_codes']) {
      await pool.query(await readFile(
        new URL(`../../database/relational/schema/${version}.sql`, import.meta.url), 'utf8'));
    }
    await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol) VALUES
      ($1,'Operador ficticio','op-rec@example.invalid','hash-solo-prueba','OPERADOR'),
      ($2,'Analista ficticio','qa-rec@example.invalid','hash-solo-prueba','ANALISTA_CALIDAD')`,
    [ids.operator, ids.analyst]);
    await pool.query('INSERT INTO proveedores(id,codigo,nombre) VALUES($1,$2,$3)',
      [ids.supplier, 'PROV-REC', 'Proveedor ficticio']);
    await pool.query(`INSERT INTO productos(id,codigo,nombre,tipo,unidad_medida)
      VALUES($1,'RAW-REC','Materia prima ficticia','MATERIA_PRIMA','KG')`, [ids.product]);
    await pool.query(`INSERT INTO ubicaciones(id,codigo,nombre,tipo)
      VALUES($1,'UB-REC','Planta ficticia','PLANTA_PRODUCCION')`, [ids.location]);

    // Catálogos proyectables, en la misma transacción del escenario.
    const catalog = [
      ['PROVEEDOR_CREADO', 'SUPPLIER', ids.supplier, { supplier: {
        id: ids.supplier, code: 'PROV-REC', name: 'Proveedor ficticio', active: true } }],
      ['PRODUCTO_CREADO', 'PRODUCT', ids.product, { product: {
        id: ids.product, code: 'RAW-REC', name: 'Materia prima ficticia',
        active: true, type: 'MATERIA_PRIMA', unit: 'KG' } }],
      ['UBICACION_CREADA', 'LOCATION', ids.location, { location: {
        id: ids.location, code: 'UB-REC', name: 'Planta ficticia',
        active: true, type: 'PLANTA_PRODUCCION' } }],
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

    // Neo4j caído: SQL confirma, evento queda recuperable.
    const deps = createSqlOperationsDeps(pool, () => '2026-11-25T21:00:00.000Z');
    const lot = await registrarRecepcion({ code: 'MP-REC', productId: ids.product,
      supplierId: ids.supplier, locationId: ids.location, quantity: '10.000',
      receivedAt: '2026-11-25T20:00:00Z', expirationDate: null,
      actorId: ids.operator, idempotencyKey: randomUUID() }, deps);
    graphIds.add(lot.id);
    const neoEvent = (await pool.query(`SELECT id,estado,intentos FROM eventos_sincronizacion
      WHERE motor_destino='NEO4J' ORDER BY secuencia LIMIT 1`)).rows[0];
    assert.equal(neoEvent.estado, 'PENDIENTE');
    assert.equal(await dispatchNext(pool, 'NEO4J', () => { throw new Error('motor caído'); }, 0), 'failed');
    const failedNeo = (await pool.query(`SELECT estado,intentos,proximo_intento_at IS NOT NULL AS programado
      FROM eventos_sincronizacion WHERE id=$1`, [neoEvent.id])).rows[0];
    assert.equal(failedNeo.estado, 'FALLIDO');
    assert.equal(failedNeo.intentos, 1);
    assert.equal(failedNeo.programado, true);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM lotes WHERE id=$1', [lot.id])).rows[0].n, 1);
    assert.equal((await graph.executeQuery('MATCH (l:Lote {id:$id}) RETURN count(l) AS n',
      { id: lot.id }, { database: graphDb })).records[0].get('n').toNumber(), 0);
    await down.close();

    // Worker interrumpido: PROCESANDO se retoma sin saltar el evento.
    await pool.query(`UPDATE eventos_sincronizacion SET estado='PROCESANDO',
      procesando_desde=now(), proximo_intento_at=NULL WHERE id=$1`, [neoEvent.id]);
    for (let i = 0; i < 4; i += 1) {
      assert.equal(await dispatchNext(pool, 'NEO4J',
        (event, signal) => applyGraphEvent(graph, graphDb, event, signal), 0), 'applied');
    }
    assert.equal((await pool.query('SELECT estado FROM eventos_sincronizacion WHERE id=$1',
      [neoEvent.id])).rows[0].estado, 'COMPLETADO');
    const projection = async () => (await graph.executeQuery(`MATCH (n) WHERE n.id IN $ids
      WITH count(n) AS nodes MATCH (a)-[r]->(b) WHERE a.id IN $ids AND b.id IN $ids
      RETURN nodes, count(r) AS edges`, { ids: [...graphIds] }, { database: graphDb }))
      .records.map((row) => [row.get('nodes').toNumber(), row.get('edges').toNumber()]);
    assert.deepEqual(await projection(), [[4, 2]]);
    // Reentrega del mismo evento: MERGE por IDs estables, sin duplicados.
    await pool.query(`UPDATE eventos_sincronizacion SET estado='PENDIENTE', intentos=0
      WHERE motor_destino='NEO4J'`);
    for (let i = 0; i < 4; i += 1) {
      assert.equal(await dispatchNext(pool, 'NEO4J',
        (event, signal) => applyGraphEvent(graph, graphDb, event, signal), 0), 'applied');
    }
    assert.deepEqual(await projection(), [[4, 2]]);

    // MongoDB caído: incidencia SQL se conserva, expediente en ERROR y luego converge.
    await mongo.connect();
    db = mongo.db(mongoDatabase);
    for (const [name, file] of [
      ['plantillas_inspeccion', 'plantillas-inspeccion'],
      ['inspecciones_calidad', 'inspecciones-calidad'],
      ['expedientes_incidencias', 'expedientes-incidencias'],
    ]) {
      await db.createCollection(name, { validator: JSON.parse(await readFile(
        new URL(`../../database/document/validators/${file}.schema.json`, import.meta.url), 'utf8')),
      validationLevel: 'strict', validationAction: 'error' });
    }
    await db.collection('expedientes_incidencias').createIndex({ incidencia_id: 1 }, { unique: true });
    incidentService = new IncidentWriteService({ pool }, { db });
    const incident = await incidentService.create({
      originLotId: lot.id, title: 'Investigación ficticia', type: 'CALIDAD', severity: 'MEDIA',
      detectedAt: '2026-11-25T20:04:00Z', description: 'Expediente ficticio',
      inspectionIds: [], findings: [], evidence: [],
    }, ids.analyst, randomUUID());
    assert.equal(incident.dossierStatus, 'PENDIENTE');
    const mongoEvent = (await pool.query(`SELECT id FROM eventos_sincronizacion
      WHERE motor_destino='MONGODB'`)).rows[0];
    assert.equal(await dispatchNext(pool, 'MONGODB', () => { throw new Error('mongo caído'); }, 0), 'failed');
    assert.equal((await pool.query('SELECT estado_expediente FROM incidencias WHERE id=$1',
      [incident.id])).rows[0].estado_expediente, 'ERROR');
    assert.equal(await db.collection('expedientes_incidencias').countDocuments({}), 0);
    assert.equal(await dispatchNext(pool, 'MONGODB',
      (event, signal) => applyDossierEvent(db, event, signal), 0), 'applied');
    assert.equal((await pool.query('SELECT estado_expediente FROM incidencias WHERE id=$1',
      [incident.id])).rows[0].estado_expediente, 'SINCRONIZADO');
    assert.equal(await db.collection('expedientes_incidencias').countDocuments({}), 1);
    await pool.query(`UPDATE eventos_sincronizacion SET estado='PENDIENTE', intentos=0
      WHERE id=$1`, [mongoEvent.id]);
    assert.equal(await dispatchNext(pool, 'MONGODB',
      (event, signal) => applyDossierEvent(db, event, signal), 0), 'applied');
    assert.equal(await db.collection('expedientes_incidencias').countDocuments({}), 1);
    assert.equal((await db.collection('expedientes_incidencias')
      .findOne({ incidencia_id: incident.id })).version, 1);

    // Fallo permanente: queda FALLIDO sin reintento automático (intervención técnica).
    await pool.query(`UPDATE eventos_sincronizacion SET estado='PENDIENTE', intentos=0
      WHERE id=$1`, [neoEvent.id]);
    assert.equal(await dispatchNext(pool, 'NEO4J', () => {
      throw new PermanentDeliveryError('evento incompatible');
    }, 0), 'failed');
    const permanent = (await pool.query(`SELECT estado,proximo_intento_at IS NULL AS sin_reintento
      FROM eventos_sincronizacion WHERE id=$1`, [neoEvent.id])).rows[0];
    assert.equal(permanent.estado, 'FALLIDO');
    assert.equal(permanent.sin_reintento, true);
    assert.equal(await dispatchNext(pool, 'NEO4J',
      (event, signal) => applyGraphEvent(graph, graphDb, event, signal), 0), 'idle');
    process.stdout.write(`OUTBOX_RECOVERY_ACTUAL=${JSON.stringify({
      transientFailures: 2, interruptedClaimRecovered: true,
      neoNodes: 4, neoEdges: 2, dossiers: 1, dossierVersion: 1, permanentNotRetried: true,
    })}\n`);
  } finally {
    try {
      if (incidentService) await incidentService.onModuleDestroy();
      await graph.executeQuery('MATCH (n) WHERE n.id IN $ids DETACH DELETE n',
        { ids: [...graphIds] }, { database: graphDb });
      await graph.close();
      if (db) await db.dropDatabase();
      await mongo.close();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    } catch (error) {
      process.stderr.write(`Limpieza: ${String(error)}\n`);
    }
  }
});
