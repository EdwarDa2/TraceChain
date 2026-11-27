import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import pg from 'pg';
import neo4j from 'neo4j-driver';
import { MongoClient, Decimal128 } from 'mongodb';
import { createSqlOperationsDeps } from '../../backend/dist/database/postgres/operations-repository.mjs';
import { createOutboxWriter } from '../../backend/dist/database/postgres/transaction.mjs';
import { registrarRecepcion, registrarProduccion, registrarDistribucion } from '../../backend/dist/modules/operations/operations.mjs';
import { dispatchNext } from '../../backend/dist/integration/outbox/dispatcher.mjs';
import { applyGraphEvent } from '../../backend/dist/integration/handlers/neo4j/projection.mjs';
import { traverseLots, commonOrigins, historicalDestinations, productionPaths } from '../../backend/dist/database/neo4j/traversal.mjs';
import { InspectionsService } from '../../backend/dist/modules/inspections/inspections.service.js';
import { IncidentWriteService } from '../../backend/dist/modules/incidents/incident-write.service.js';
import { BlockWriteService } from '../../backend/dist/modules/lot-blocks/block-write.service.js';
import { ImpactService } from '../../backend/dist/modules/impact/impact.service.js';
import { TraceabilityService } from '../../backend/dist/modules/traceability/traceability.service.js';
import { applyDossierEvent } from '../../backend/dist/integration/handlers/mongodb/dossier-projection.mjs';

test('escenario canónico multimodelo real: 9 lotes, 5 procesos, 3 distribuciones y calidad', async () => {
  for (const name of ['DATABASE_URL', 'MONGODB_URI', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    assert.ok(process.env[name]);
  }
  const schema = `canonical_ops_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`, max: 8 });
  const graph = neo4j.driver(process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
  const mongo = new MongoClient(process.env.MONGODB_URI);
  const mongoDatabase = `tracechain_canonical_${randomUUID().replaceAll('-', '')}`;
  const db = mongo.db(mongoDatabase);
  const dbName = process.env.NEO4J_DATABASE ?? 'neo4j';
  const allIds = new Set();
  const actor = randomUUID();
  const analyst = randomUUID();
  let incidentService;
  let blockService;
  let impactService;
  let traceService;
  const suppliers = new Map(['PROV-001', 'PROV-002', 'PROV-003'].map((code) => [code, randomUUID()]));
  const productSpecs = [
    ['PRD-001', 'Harina', 'MATERIA_PRIMA', 'KG'],
    ['PRD-002', 'Azúcar', 'MATERIA_PRIMA', 'KG'],
    ['PRD-003', 'Mantequilla', 'MATERIA_PRIMA', 'KG'],
    ['PRD-004', 'Masa', 'INTERMEDIO', 'KG'],
    ['PRD-005', 'Mezcla', 'INTERMEDIO', 'KG'],
    ['PRD-006', 'Pan', 'TERMINADO', 'UNIDAD'],
    ['PRD-007', 'Galletas', 'TERMINADO', 'UNIDAD'],
  ];
  const products = new Map(productSpecs.map(([code]) => [code, randomUUID()]));
  const locations = new Map(['UB-001', 'SUC-01', 'SUC-02', 'SUC-03']
    .map((code) => [code, randomUUID()]));
  const lots = new Map();
  const at = (minutes) => new Date(Date.parse('2026-11-25T15:00:00Z') + minutes * 60_000).toISOString();
  const deps = createSqlOperationsDeps(pool, () => '2026-11-25T20:00:00.000Z');
  try {
    for (const version of ['001_catalogs', '002_inventory', '003_production',
      '004_distribution', '005_incidents', '006_integration', '007_views_indexes', '008_operation_codes']) {
      await pool.query(await readFile(
        new URL(`../../database/relational/schema/${version}.sql`, import.meta.url), 'utf8'));
    }
    await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol)
      VALUES($1,'Operador ficticio','canonical@example.invalid','hash-solo-prueba','OPERADOR')`, [actor]);
    await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol)
      VALUES($1,'Analista ficticio','analista-canonical@example.invalid','hash-solo-prueba','ANALISTA_CALIDAD')`, [analyst]);
    const events = [];
    for (const [code, id] of suppliers) {
      allIds.add(id);
      await pool.query('INSERT INTO proveedores(id,codigo,nombre) VALUES($1,$2,$3)',
        [id, code, `Proveedor ficticio ${code}`]);
      events.push(['PROVEEDOR_CREADO', 'SUPPLIER', id,
        { supplier: { id, code, name: `Proveedor ficticio ${code}`, active: true } }]);
    }
    for (const [code, name, type, unit] of productSpecs) {
      const id = products.get(code);
      allIds.add(id);
      await pool.query('INSERT INTO productos(id,codigo,nombre,tipo,unidad_medida) VALUES($1,$2,$3,$4,$5)',
        [id, code, name, type, unit]);
      events.push(['PRODUCTO_CREADO', 'PRODUCT', id,
        { product: { id, code, name, type, unit, active: true } }]);
    }
    for (const [code, id] of locations) {
      const type = code === 'UB-001' ? 'PLANTA_PRODUCCION' : 'SUCURSAL';
      allIds.add(id);
      await pool.query('INSERT INTO ubicaciones(id,codigo,nombre,tipo) VALUES($1,$2,$3,$4)',
        [id, code, `Ubicación ficticia ${code}`, type]);
      events.push(['UBICACION_CREADA', 'LOCATION', id,
        { location: { id, code, name: `Ubicación ficticia ${code}`, type, active: true } }]);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [eventType, entityType, entityId, payload] of events) {
        await createOutboxWriter().enqueue({ eventId: randomUUID(), eventType, entityType,
          entityId, destination: 'NEO4J', payload }, client);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    const receipts = [
      ['MP-001', 'PRD-001', 'PROV-001', '100.000'],
      ['MP-002', 'PRD-002', 'PROV-002', '40.000'],
      ['MP-003', 'PRD-003', 'PROV-003', '20.000'],
      ['MP-004', 'PRD-001', 'PROV-001', '50.000'],
    ];
    for (const [index, [code, product, supplier, quantity]] of receipts.entries()) {
      const response = await registrarRecepcion({ code, productId: products.get(product),
        supplierId: suppliers.get(supplier), locationId: locations.get('UB-001'),
        quantity, receivedAt: at(index), expirationDate: null,
        actorId: actor, idempotencyKey: randomUUID() }, deps);
      lots.set(code, response.id);
      allIds.add(response.id);
    }
    const productionSpecs = [
      [[['MP-001', '30.000'], ['MP-002', '5.000'], ['MP-003', '2.000']], [['LP-001', 'PRD-004', '35.000']]],
      [[['MP-001', '20.000'], ['MP-002', '10.000']], [['LP-002', 'PRD-005', '28.000']]],
      [[['LP-001', '25.000']], [['LP-003', 'PRD-006', '100.000']]],
      [[['LP-002', '20.000']], [['LP-004', 'PRD-007', '80.000']]],
      [[['MP-004', '15.000']], [['LP-005', 'PRD-006', '60.000']]],
    ];
    for (const [index, [inputSpecs, outputSpecs]] of productionSpecs.entries()) {
      const response = await registrarProduccion({ name: `Proceso ficticio ${index + 1}`,
        locationId: locations.get('UB-001'), producedAt: at(10 + index),
        inputs: inputSpecs.map(([code, quantity]) => ({ lotId: lots.get(code), quantity })),
        outputs: outputSpecs.map(([code, product, quantity]) =>
          ({ code, productId: products.get(product), quantity, expirationDate: null })),
        actorId: actor, idempotencyKey: randomUUID() }, deps);
      allIds.add(response.id);
      for (const output of response.outputs) {
        lots.set(output.lotCode, output.lotId);
        allIds.add(output.lotId);
      }
    }
    for (const [index, [code, quantity, destination]] of [
      ['LP-003', '40.000', 'SUC-01'],
      ['LP-004', '30.000', 'SUC-02'],
      ['LP-005', '20.000', 'SUC-03'],
    ].entries()) {
      const response = await registrarDistribucion({ originLocationId: locations.get('UB-001'),
        destinationLocationId: locations.get(destination), distributedAt: at(20 + index),
        items: [{ lotId: lots.get(code), quantity }], actorId: actor,
        idempotencyKey: randomUUID() }, deps);
      allIds.add(response.id);
    }
    const expectedStock = {
      'MP-001': ['UB-001', '50.000'], 'MP-002': ['UB-001', '25.000'],
      'MP-003': ['UB-001', '18.000'], 'MP-004': ['UB-001', '35.000'],
      'LP-001': ['UB-001', '10.000'], 'LP-002': ['UB-001', '8.000'],
      'LP-003': ['UB-001', '60.000'], 'LP-004': ['UB-001', '50.000'],
      'LP-005': ['UB-001', '40.000'],
    };
    const stock = await pool.query(`SELECT l.codigo, u.codigo AS ubicacion, e.cantidad::text AS cantidad
      FROM existencias e JOIN lotes l ON l.id=e.lote_id JOIN ubicaciones u ON u.id=e.ubicacion_id`);
    for (const [code, [location, amount]] of Object.entries(expectedStock)) {
      assert.ok(stock.rows.some((row) => row.codigo === code &&
        row.ubicacion === location && row.cantidad === amount), code);
    }
    for (const [code, location, amount] of [
      ['LP-003', 'SUC-01', '40.000'], ['LP-004', 'SUC-02', '30.000'],
      ['LP-005', 'SUC-03', '20.000']]) {
      assert.ok(stock.rows.some((row) => row.codigo === code &&
        row.ubicacion === location && row.cantidad === amount), `${code}/${location}`);
    }
    assert.equal(stock.rows.length, 12);
    const totalEvents = events.length + receipts.length + productionSpecs.length + 3;
    assert.equal(totalEvents, 26);
    for (let i = 0; i < totalEvents; i += 1) {
      assert.equal(await dispatchNext(pool, 'NEO4J',
        (event, signal) => applyGraphEvent(graph, dbName, event, signal)), 'applied');
    }
    const count = await graph.executeQuery(`MATCH (n) WHERE n.id IN $ids
      WITH count(n) AS nodes MATCH (a)-[r]->(b)
      WHERE a.id IN $ids AND b.id IN $ids RETURN nodes, count(r) AS edges`,
    { ids: [...allIds] }, { database: dbName });
    assert.deepEqual(count.records.map((record) =>
      [record.get('nodes').toNumber(), record.get('edges').toNumber()]), [[31, 35]]);
    const forward = await traverseLots(graph, dbName, lots.get('MP-001'), 'FORWARD');
    assert.equal(forward.status, 'COMPLETO');
    assert.deepEqual(forward.lots.map(({ lotId, depth }) =>
      [([...lots].find(([, id]) => id === lotId) ?? [null])[0], depth]).sort(),
    [['LP-001', 1], ['LP-002', 1], ['LP-003', 2], ['LP-004', 2]]);
    const common = await commonOrigins(graph, dbName, [lots.get('LP-003'), lots.get('LP-004')]);
    assert.equal(common.status, 'COMPLETO');
    assert.deepEqual(common.lots.map(({ lotId }) =>
      ([...lots].find(([, id]) => id === lotId) ?? [null])[0]).sort(), ['MP-001', 'MP-002']);
    const destinations = await historicalDestinations(graph, dbName,
      [lots.get('MP-001'), ...forward.lots.map(({ lotId }) => lotId)]);
    assert.deepEqual(destinations.map(({ locationId }) =>
      [...locations].find(([, id]) => id === locationId)?.[0]).sort(), ['SUC-01', 'SUC-02']);
    const path = await productionPaths(graph, dbName, lots.get('MP-001'), lots.get('LP-003'), 'SHORTEST');
    assert.equal(path.paths[0]?.depth, 2);
    const noPath = await productionPaths(graph, dbName, lots.get('MP-001'), lots.get('LP-005'), 'ALL');
    assert.deepEqual(noPath.paths, []);
    assert.equal(noPath.status, 'COMPLETO');
    const sqlCounts = (await pool.query(`SELECT
      (SELECT count(*)::int FROM lotes) AS lots,
      (SELECT count(*)::int FROM ordenes_produccion) AS processes,
      (SELECT count(*)::int FROM distribuciones) AS distributions,
      (SELECT count(*)::int FROM movimientos) AS movements`)).rows[0];
    assert.deepEqual(sqlCounts, { lots: 9, processes: 5, distributions: 3, movements: 23 });
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
    const templateSpecs = JSON.parse(await readFile(
      new URL('../../database/document/data/plantillas-inspeccion.json', import.meta.url), 'utf8'));
    const templateProducts = new Map([
      ['TPL-HARINA', 'PRD-001'], ['TPL-AZUCAR', 'PRD-002'],
      ['TPL-MASA', 'PRD-004'], ['TPL-PAN', 'PRD-006'],
      ['TPL-GALLETAS', 'PRD-007'], ['TPL-GENERAL', null],
    ]);
    const templateIds = new Map();
    for (const template of templateSpecs) {
      const productCode = templateProducts.get(template.codigo);
      assert.notEqual(productCode, undefined);
      const id = randomUUID();
      templateIds.set(template.codigo, id);
      await db.collection('plantillas_inspeccion').insertOne({
        ...template, _id: id, producto_id: productCode ? products.get(productCode) : null,
        created_at: new Date(template.created_at),
        parametros: template.parametros.map((param) => ({
          ...param,
          min: param.min === null ? null : param.dataType === 'DECIMAL'
            ? Decimal128.fromString(param.min) : Number(param.min),
          max: param.max === null ? null : param.dataType === 'DECIMAL'
            ? Decimal128.fromString(param.max) : Number(param.max),
        })),
      });
    }
    const inspectionsService = new InspectionsService({ pool }, { db });
    const inspectionSpecs = [
      ['MP-001', 'TPL-HARINA', { humedad: '16.5', color: 'BLANCO', impurezas: true, empaque: 'INTEGRO' },
        'NO_CONFORME', 'IMPUREZAS', 'ALTA', 'impurezas'],
      ['LP-003', 'TPL-PAN', { peso: '450.5', textura: 'SUAVE', empaque: 'INTEGRO' },
        'NO_CONFORME', 'APARIENCIA', 'MEDIA', null],
      ['LP-004', 'TPL-GALLETAS', { peso: '150', piezas_danadas: 2, textura: 'BLANDA', empaque: 'INTEGRO' },
        'NO_CONFORME', 'TEXTURA', 'MEDIA', 'textura'],
      ['LP-005', 'TPL-PAN', { peso: '450', textura: 'SUAVE', empaque: 'INTEGRO' },
        'CONFORME', null, null, null],
    ];
    const inspections = new Map();
    for (const [index, [code, template, parameters, result, findingType, severity, parameter]] of
      inspectionSpecs.entries()) {
      const created = await inspectionsService.create({
        lotId: lots.get(code), templateId: templateIds.get(template), templateVersion: 1,
        inspectedAt: at(30 + index), parameters, result,
        findings: findingType ? [{ type: findingType, parameter,
          description: 'Hallazgo ficticio de investigación', severity }] : [],
        evidence: [],
      }, analyst, randomUUID());
      inspections.set(code, created.id);
    }
    assert.equal(await db.collection('inspecciones_calidad').countDocuments({}), 4);
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
    process.env.JWT_SECRET = 'clave-ficticia-canonical-para-pruebas-12345';
    incidentService = new IncidentWriteService({ pool }, { db });
    const incident = await incidentService.create({
      originLotId: lots.get('MP-001'), title: 'Investigación ficticia',
      type: 'CALIDAD', severity: 'ALTA', detectedAt: at(35),
      description: 'Expediente ficticio de materia prima',
      inspectionIds: [inspections.get('MP-001')], findings: [], evidence: [],
    }, analyst, randomUUID());
    assert.equal(incident.dossierStatus, 'PENDIENTE');
    assert.equal(await dispatchNext(pool, 'MONGODB',
      (event, signal) => applyDossierEvent(db, event, signal)), 'applied');
    assert.equal((await pool.query('SELECT estado_expediente FROM incidencias WHERE id=$1',
      [incident.id])).rows[0].estado_expediente, 'SINCRONIZADO');
    assert.deepEqual((await db.collection('expedientes_incidencias')
      .findOne({ incidencia_id: incident.id })).inspecciones_ids, [inspections.get('MP-001')]);
    const analysis = await incidentService.startAnalysis(incident.id, analyst, randomUUID());
    assert.equal(analysis.status, 'EN_ANALISIS');
    assert.equal((await pool.query('SELECT estado FROM incidencias WHERE id=$1',
      [incident.id])).rows[0].estado, 'EN_ANALISIS');
    impactService = new ImpactService({ pool }, { db });
    const impact = await impactService.get(incident.id);
    assert.equal(impact.status, 'COMPLETO');
    assert.equal(impact.quality.status, 'COMPLETO');
    assert.deepEqual(impact.summary, {
      originLots: 1, directLots: 2, indirectLots: 2, totalAffectedLots: 5,
      destinationCount: 2, blockedLots: 0,
    });
    assert.deepEqual(impact.affectedLots.map((item) => [item.code, item.depth]),
      [['MP-001', 0], ['LP-001', 1], ['LP-002', 1], ['LP-003', 2], ['LP-004', 2]]);
    assert.equal(impact.quality.data.dossier.inspections[0].id, inspections.get('MP-001'));
    assert.equal(impact.quality.data.byLot.reduce((sum, item) => sum + item.nonConforming, 0), 3);
    assert.deepEqual(impact.destinations.data.map((item) => item.locationName).sort(),
      ['Ubicación ficticia SUC-01', 'Ubicación ficticia SUC-02']);
    assert.deepEqual(impact.stockByLocation.data.filter((item) => item.lotCode === 'LP-003')
      .map((item) => item.physicalQuantity).sort(), ['40.000', '60.000']);
    const shallow = await impactService.get(incident.id, 1);
    assert.equal(shallow.status, 'PARCIAL');
    assert.equal(shallow.metadata.analysisTruncated, true);
    assert.ok(shallow.metadata.warnings.some((warning) => warning.code === 'DEPTH_LIMIT'));
    traceService = new TraceabilityService({ pool });
    const traceForward = await traceService.forward(lots.get('MP-001'), 10);
    assert.equal(traceForward.status, 'COMPLETO');
    assert.deepEqual(traceForward.lots.map((item) => [item.code, item.depth, item.direction]),
      [['LP-001', 1, 'FORWARD'], ['LP-002', 1, 'FORWARD'],
        ['LP-003', 2, 'FORWARD'], ['LP-004', 2, 'FORWARD']]);
    assert.equal(traceForward.processes.length, 4);
    assert.deepEqual(traceForward.destinations.map((item) => item.locationName).sort(),
      ['Ubicación ficticia SUC-01', 'Ubicación ficticia SUC-02']);
    const traceBackward = await traceService.backward(lots.get('LP-003'), 10);
    assert.equal(traceBackward.status, 'COMPLETO');
    assert.deepEqual(traceBackward.lots.map((item) => [item.code, item.depth]),
      [['LP-001', 1], ['MP-001', 2], ['MP-002', 2], ['MP-003', 2]]);
    assert.equal(traceBackward.suppliers.length, 3);
    const traceGenealogy = await traceService.genealogy(lots.get('LP-003'), 10);
    assert.equal(traceGenealogy.status, 'COMPLETO');
    assert.deepEqual(traceGenealogy.lots.map((item) => item.direction),
      ['BACKWARD', 'BACKWARD', 'BACKWARD', 'BACKWARD']);
    const traceCommon = await traceService.common([lots.get('LP-003'), lots.get('LP-004')], 10);
    assert.equal(traceCommon.status, 'COMPLETO');
    assert.deepEqual(traceCommon.lots.map((item) => item.code), ['MP-001', 'MP-002']);
    assert.equal(Object.keys(traceCommon.lots[0].depthByRoot).length, 2);
    const traceShortest = await traceService.paths(lots.get('MP-001'), lots.get('LP-003'),
      'SHORTEST', 10, 50);
    assert.equal(traceShortest.status, 'COMPLETO');
    assert.equal(traceShortest.paths.length, 1);
    assert.equal(traceShortest.paths[0].depth, 2);
    assert.equal(traceShortest.paths[0].edgeIds.length, 4);
    const traceNoPath = await traceService.paths(lots.get('MP-001'), lots.get('LP-005'), 'ALL', 10, 50);
    assert.deepEqual(traceNoPath.paths, []);
    assert.equal(traceNoPath.status, 'COMPLETO');
    const shallowTrace = await traceService.forward(lots.get('MP-001'), 1);
    assert.equal(shallowTrace.status, 'PARCIAL');
    assert.ok(shallowTrace.metadata.warnings.some((warning) => warning.code === 'DEPTH_LIMIT'));
    blockService = new BlockWriteService({ pool });
    await assert.rejects(blockService.block(incident.id, [lots.get('MP-004')],
      'No pertenece a la genealogía', analyst, randomUUID()), /LOT_NOT_IN_IMPACT/);
    const blocked = await blockService.block(incident.id,
      [lots.get('MP-001'), lots.get('LP-003')], 'Investigación manual ficticia',
      analyst, randomUUID());
    assert.equal(blocked.length, 2);
    await assert.rejects(registrarDistribucion({
      originLocationId: locations.get('UB-001'), destinationLocationId: locations.get('SUC-01'),
      distributedAt: at(40), items: [{ lotId: lots.get('LP-003'), quantity: '1.000' }],
      actorId: actor, idempotencyKey: randomUUID(),
    }, deps), /LOT_BLOCKED/);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM distribuciones`)).rows[0].n, 3);
    for (const block of blocked) {
      const released = await blockService.release(block.id, 'Revisión ficticia', analyst, randomUUID());
      assert.equal(released.active, false);
    }
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM bloqueos_lotes WHERE activo`)).rows[0].n, 0);
    const results = await db.collection('inspecciones_calidad')
      .aggregate([{ $group: { _id: '$resultado', count: { $sum: 1 } } }]).toArray();
    assert.deepEqual(Object.fromEntries(results.map((row) => [row._id, row.count])),
      { CONFORME: 1, NO_CONFORME: 3 });
    process.stdout.write(`CANONICAL_OPERATIONS_ACTUAL=${JSON.stringify({
      ...sqlCounts, graphNodes: 31, graphEdges: 35,
      descendants: 4, commonOrigins: 2, destinations: 2,
      inspections: 4, nonConforming: 3, incidents: 1, dossiers: 1,
      manualBlocksTested: 2, activeBlocksAtEnd: 0, traceModes: 5,
    })}\n`);
  } finally {
    try {
      if (blockService) await blockService.onModuleDestroy();
      if (traceService) await traceService.onModuleDestroy();
      if (impactService) await impactService.onModuleDestroy();
      if (incidentService) await incidentService.onModuleDestroy();
      await graph.executeQuery('MATCH (n) WHERE n.id IN $ids DETACH DELETE n',
        { ids: [...allIds] }, { database: dbName });
    } finally {
      await graph.close();
      await db.dropDatabase();
      await mongo.close();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  }
});
