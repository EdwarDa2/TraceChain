/**
 * DEMO-150: semilla funcional determinista por servicios y Outbox, aislada del
 * fixture canónico y del benchmark. No es evidencia de rendimiento.
 */
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
import {
  registrarRecepcion, registrarProduccion, registrarDistribucion,
} from '../../backend/dist/modules/operations/operations.mjs';
import { dispatchNext } from '../../backend/dist/integration/outbox/dispatcher.mjs';
import { applyGraphEvent } from '../../backend/dist/integration/handlers/neo4j/projection.mjs';
import { applyDossierEvent } from '../../backend/dist/integration/handlers/mongodb/dossier-projection.mjs';
import { InspectionsService } from '../../backend/dist/modules/inspections/inspections.service.js';
import { IncidentWriteService } from '../../backend/dist/modules/incidents/incident-write.service.js';
import { ImpactService } from '../../backend/dist/modules/impact/impact.service.js';
import { BlockWriteService } from '../../backend/dist/modules/lot-blocks/block-write.service.js';
import {
  traverseLots, commonOrigins, productionPaths,
} from '../../backend/dist/database/neo4j/traversal.mjs';

const CLOCK = '2026-11-25T20:00:00.000Z';
const BASE = Date.parse('2026-11-24T00:00:00Z');
const fixed = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('DEMO-150 real: 150 lotes, 60 órdenes, 40 distribuciones, 80 inspecciones y 10 expedientes', async () => {
  for (const name of ['DATABASE_URL', 'MONGODB_URI', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    assert.ok(process.env[name], `falta ${name}`);
  }
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
  process.env.JWT_SECRET = 'clave-ficticia-demo150-para-pruebas-12345';
  const schema = `demo150_${randomUUID().replaceAll('-', '')}`;
  const mongoDatabase = `tracechain_demo150_${randomUUID().replaceAll('-', '')}`;
  const graphDb = process.env.NEO4J_DATABASE ?? 'neo4j';
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`, max: 10 });
  const graph = neo4j.driver(process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
  const mongo = new MongoClient(process.env.MONGODB_URI);
  const graphIds = new Set();
  let db;
  let generated = 2_000_000;
  let minute = 0;
  const at = () => new Date(BASE + (minute += 1) * 60_000).toISOString();
  const lotIds = new Map();
  const lotAliases = new Map();
  const lotProducts = new Map();
  const incidentIds = [];
  const inspectionIds = new Map();
  let incidentService;
  let impactService;
  let blockService;
  try {
    for (const version of ['001_catalogs', '002_inventory', '003_production',
      '004_distribution', '005_incidents', '006_integration', '007_views_indexes', '008_operation_codes']) {
      await pool.query(await readFile(
        new URL(`../../database/relational/schema/${version}.sql`, import.meta.url), 'utf8'));
    }
    await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol) VALUES
      ($1,'Operador ficticio','operador-demo150@example.invalid','hash-solo-prueba','OPERADOR'),
      ($2,'Analista ficticio','analista-demo150@example.invalid','hash-solo-prueba','ANALISTA_CALIDAD')`,
    [fixed(101), fixed(102)]);

    const supplierCodes = Array.from({ length: 8 }, (_, i) => `PROV-${String(i + 1).padStart(3, '0')}`);
    const rawCodes = ['PRD-001', 'PRD-002', 'PRD-003', 'PRD-008', 'PRD-009'];
    const intermediateCodes = ['PRD-004', 'PRD-005', 'PRD-010', 'PRD-011'];
    const finishedCodes = ['PRD-006', 'PRD-007', 'PRD-012', 'PRD-013', 'PRD-014', 'PRD-015'];
    const productCodes = [
      ['PRD-001', 'Harina', 'MATERIA_PRIMA', 'KG'], ['PRD-002', 'Azúcar', 'MATERIA_PRIMA', 'KG'],
      ['PRD-003', 'Mantequilla', 'MATERIA_PRIMA', 'KG'], ['PRD-004', 'Masa', 'INTERMEDIO', 'KG'],
      ['PRD-005', 'Mezcla', 'INTERMEDIO', 'KG'], ['PRD-006', 'Pan', 'TERMINADO', 'UNIDAD'],
      ['PRD-007', 'Galletas', 'TERMINADO', 'UNIDAD'], ['PRD-008', 'Sal', 'MATERIA_PRIMA', 'KG'],
      ['PRD-009', 'Levadura', 'MATERIA_PRIMA', 'KG'], ['PRD-010', 'Prefermento', 'INTERMEDIO', 'KG'],
      ['PRD-011', 'Masa laminada', 'INTERMEDIO', 'KG'], ['PRD-012', 'Bollo', 'TERMINADO', 'UNIDAD'],
      ['PRD-013', 'Pan integral', 'TERMINADO', 'UNIDAD'], ['PRD-014', 'Pan dulce', 'TERMINADO', 'UNIDAD'],
      ['PRD-015', 'Galleta de avena', 'TERMINADO', 'UNIDAD'],
    ];
    const locationCodes = ['UB-001', 'SUC-01', 'SUC-02', 'SUC-03', 'SUC-04', 'SUC-05'];
    const supplierIds = new Map(supplierCodes.map((code, i) => [code, fixed(201 + i)]));
    const productIds = new Map(productCodes.map(([code], i) => [code, fixed(301 + i)]));
    const locationIds = new Map(locationCodes.map((code, i) => [code, fixed(401 + i)]));
    for (const [code, id] of supplierIds) {
      await pool.query('INSERT INTO proveedores(id,codigo,nombre) VALUES($1,$2,$3)',
        [id, code, `Proveedor ficticio ${code}`]);
    }
    for (const [code, name, type, unit] of productCodes) {
      await pool.query('INSERT INTO productos(id,codigo,nombre,tipo,unidad_medida) VALUES($1,$2,$3,$4,$5)',
        [productIds.get(code), code, name, type, unit]);
    }
    for (const [code, id] of locationIds) {
      const type = code === 'UB-001' ? 'PLANTA_PRODUCCION' : 'SUCURSAL';
      await pool.query('INSERT INTO ubicaciones(id,codigo,nombre,tipo) VALUES($1,$2,$3,$4)',
        [id, code, `Ubicación ficticia ${code}`, type]);
    }
    const catalogEvents = [];
    for (const [code, id] of supplierIds) {
      graphIds.add(id);
      catalogEvents.push(['PROVEEDOR_CREADO', 'SUPPLIER', id, { supplier: {
        id, code, name: `Proveedor ficticio ${code}`, active: true } }]);
    }
    for (const [code, name, type, unit] of productCodes) {
      const id = productIds.get(code);
      graphIds.add(id);
      catalogEvents.push(['PRODUCTO_CREADO', 'PRODUCT', id, { product: {
        id, code, name, type, unit, active: true } }]);
    }
    for (const [code, id] of locationIds) {
      const type = code === 'UB-001' ? 'PLANTA_PRODUCCION' : 'SUCURSAL';
      graphIds.add(id);
      catalogEvents.push(['UBICACION_CREADA', 'LOCATION', id, { location: {
        id, code, name: `Ubicación ficticia ${code}`, type, active: true } }]);
    }
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      for (const [eventType, entityType, entityId, payload] of catalogEvents) {
        await createOutboxWriter().enqueue({ eventId: randomUUID(), eventType,
          entityType, entityId, destination: 'NEO4J', payload }, tx);
      }
      await tx.query('COMMIT');
    } catch (error) {
      await tx.query('ROLLBACK');
      throw error;
    } finally {
      tx.release();
    }

    const deps = createSqlOperationsDeps(pool, () => CLOCK);
    deps.nuevoId = () => fixed(++generated);
    const cursors = { supplier: 0, raw: 0, intermediate: 0, finished: 0 };
    const pick = (list, key) => list[cursors[key]++ % list.length];
    const upsertLot = (alias, id, productCode) => {
      lotIds.set(alias, id);
      lotAliases.set(id, alias);
      lotProducts.set(alias, productCode);
      graphIds.add(id);
    };
    for (let group = 1; group <= 10; group += 1) {
      for (const suffix of ['R1', 'R2', 'R3']) {
        const alias = `D${String(group).padStart(2, '0')}-${suffix}`;
        const supplierCode = pick(supplierCodes, 'supplier');
        const productCode = pick(rawCodes, 'raw');
        const response = await registrarRecepcion({
          code: alias, productId: productIds.get(productCode),
          supplierId: supplierIds.get(supplierCode), locationId: locationIds.get('UB-001'),
          quantity: '100.000', receivedAt: at(), expirationDate: null,
          actorId: fixed(101), idempotencyKey: randomUUID(),
        }, deps);
        upsertLot(alias, response.id, productCode);
      }
      const prefix = `D${String(group).padStart(2, '0')}`;
      const processes = [
        { name: 'p1', inputs: [['R1', '5.000'], ['R2', '5.000']], outputs: [['A1', '20.000', 'intermediate'], ['A2', '20.000', 'intermediate']] },
        { name: 'p2', inputs: [['A1', '5.000'], ['R3', '5.000']], outputs: [['B1', '20.000', 'intermediate'], ['B2', '20.000', 'intermediate']] },
        { name: 'p3', inputs: [['A2', '5.000'], ['R3', '5.000']], outputs: [['C1', '20.000', 'intermediate'], ['C2', '20.000', 'intermediate']] },
        { name: 'p4', inputs: [['B1', '5.000'], ['C1', '5.000']], outputs: [['D1', '20.000', 'intermediate'], ['D2', '20.000', 'intermediate']] },
        { name: 'p5', inputs: [['D1', '5.000'], ['B2', '5.000']], outputs: [['E1', '20.000', 'intermediate'], ['E2', '40.000', 'finished']] },
        { name: 'p6', inputs: [['E1', '5.000'], ['D2', '5.000']], outputs: [['F1', '40.000', 'finished'], ['F2', '40.000', 'finished']] },
      ];
      for (const process of processes) {
        const outputProducts = process.outputs.map(([, , kind]) =>
          pick(kind === 'finished' ? finishedCodes : intermediateCodes, kind));
        const response = await registrarProduccion({
          name: `Proceso ${prefix} ${process.name}`, locationId: locationIds.get('UB-001'),
          producedAt: at(), inputs: process.inputs.map(([suffix, quantity]) =>
            ({ lotId: lotIds.get(`${prefix}-${suffix}`), quantity })),
          outputs: process.outputs.map(([suffix, quantity], index) => ({
            code: `${prefix}-${suffix}`, productId: productIds.get(outputProducts[index]),
            quantity, expirationDate: null,
          })),
          actorId: fixed(101), idempotencyKey: randomUUID(),
        }, deps);
        graphIds.add(response.id);
        response.outputs.forEach((output, index) =>
          upsertLot(output.lotCode, output.lotId, outputProducts[index]));
      }
      const destinations = Array.from({ length: 4 }, (_, k) =>
        locationCodes[1 + ((group - 1 + k) % 5)]);
      const [branchB, branchC, branchD, branchE] = destinations;
      const transfers = [
        ['F1', '12.000', 'UB-001', branchB],
        ['F1', '4.000', branchB, branchC],
        ['F2', '10.000', 'UB-001', branchD],
        ['E2', '3.000', 'UB-001', branchE],
      ];
      for (const [suffix, quantity, origin, destination] of transfers) {
        const response = await registrarDistribucion({
          originLocationId: locationIds.get(origin), destinationLocationId: locationIds.get(destination),
          distributedAt: at(), items: [{ lotId: lotIds.get(`${prefix}-${suffix}`), quantity }],
          actorId: fixed(101), idempotencyKey: randomUUID(),
        }, deps);
        graphIds.add(response.id);
      }
    }
    const sqlCounts = (await pool.query(`SELECT
      (SELECT count(*)::int FROM lotes) AS lots,
      (SELECT count(*)::int FROM ordenes_produccion) AS processes,
      (SELECT count(*)::int FROM distribuciones) AS distributions,
      (SELECT count(*)::int FROM movimientos) AS movements,
      (SELECT count(*)::int FROM eventos_sincronizacion WHERE motor_destino='NEO4J') AS "neoEvents"`)).rows[0];
    assert.deepEqual(sqlCounts, { lots: 150, processes: 60, distributions: 40,
      movements: 350, neoEvents: 159 });

    for (let i = 0; i < sqlCounts.neoEvents; i += 1) {
      assert.equal(await dispatchNext(pool, 'NEO4J',
        (event, signal) => applyGraphEvent(graph, graphDb, event, signal)), 'applied');
    }
    const graphCounts = await graph.executeQuery(`MATCH (n) WHERE n.id IN $ids
      WITH labels(n)[0] AS label, count(n) AS total
      ORDER BY label RETURN label, total`, { ids: [...graphIds] }, { database: graphDb });
    const edgeCounts = await graph.executeQuery(`MATCH (a)-[r]->(b)
      WHERE a.id IN $ids AND b.id IN $ids
      WITH type(r) AS type, count(r) AS total ORDER BY type RETURN type, total`,
    { ids: [...graphIds] }, { database: graphDb });
    const asObject = (records, key) => Object.fromEntries(records.map((row) =>
      [row.get(key), row.get('total').toNumber()]));
    assert.deepEqual(asObject(graphCounts.records, 'label'), {
      Distribucion: 40, Lote: 150, Producto: 15, Proceso: 60,
      Proveedor: 8, Ubicacion: 6,
    });
    assert.deepEqual(asObject(edgeCounts.records, 'type'), {
      CORRESPONDE_A: 150, ENTREGADO_A: 40, GENERA: 120,
      INCLUIDO_EN: 40, SALE_DE: 40, SUMINISTRA: 30, UTILIZADO_EN: 120,
    });

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
    await db.collection('inspecciones_calidad').createIndex(
      { inspector_id: 1, idempotency_key: 1 }, { unique: true });
    await db.collection('expedientes_incidencias').createIndex({ incidencia_id: 1 }, { unique: true });
    const templateSpecs = JSON.parse(await readFile(
      new URL('../../database/document/data/plantillas-inspeccion.json', import.meta.url), 'utf8'));
    const templateProduct = new Map([
      ['TPL-HARINA', 'PRD-001'], ['TPL-AZUCAR', 'PRD-002'], ['TPL-MASA', 'PRD-004'],
      ['TPL-PAN', 'PRD-006'], ['TPL-GALLETAS', 'PRD-007'], ['TPL-GENERAL', null],
    ]);
    const templateIds = new Map();
    for (const template of templateSpecs) {
      const code = templateProduct.get(template.codigo);
      assert.notEqual(code, undefined);
      const id = fixed(800 + [...templateProduct.keys()].indexOf(template.codigo) + 1);
      templateIds.set(template.codigo, id);
      await db.collection('plantillas_inspeccion').insertOne({
        ...template, _id: id, producto_id: code === null ? null : productIds.get(code),
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
    const parameterSets = new Map([
      ['PRD-001', { humedad: '16.5', color: 'BLANCO', impurezas: true, empaque: 'INTEGRO' }],
      ['PRD-002', { humedad: '5.0', color: 'BLANCO', grumos: false, impurezas: false }],
      ['PRD-004', { temperatura: '25.0', textura: 'SUAVE', consistencia: 'HOMOGENEA' }],
      ['PRD-006', { peso: '450.000', textura: 'SUAVE', empaque: 'INTEGRO' }],
      ['PRD-007', { peso: '150.000', piezas_danadas: 0, textura: 'CRUJIENTE', empaque: 'INTEGRO' }],
    ]);
    const templateOf = (productCode) => {
      const map = new Map([['PRD-001', 'TPL-HARINA'], ['PRD-002', 'TPL-AZUCAR'],
        ['PRD-004', 'TPL-MASA'], ['PRD-006', 'TPL-PAN'], ['PRD-007', 'TPL-GALLETAS']]);
      return map.get(productCode) ?? 'TPL-GENERAL';
    };
    const inspectionService = new InspectionsService({ pool }, { db });
    for (let group = 1; group <= 10; group += 1) {
      const prefix = `D${String(group).padStart(2, '0')}`;
      for (const suffix of ['R1', 'A1', 'B2', 'C2', 'D1', 'E2', 'F1', 'F2']) {
        const alias = `${prefix}-${suffix}`;
        const productCode = lotProducts.get(alias);
        const nonConforming = ['R1', 'B2', 'C2', 'F1'].includes(suffix);
        const created = await inspectionService.create({
          lotId: lotIds.get(alias), templateId: templateIds.get(templateOf(productCode)),
          templateVersion: 1, inspectedAt: at(),
          parameters: parameterSets.get(productCode) ?? {
            apariencia: 'Observación ficticia', estado: 'NORMAL', anomalias: false,
          },
          result: nonConforming ? 'NO_CONFORME' : 'CONFORME',
          findings: nonConforming ? [{ type: 'APARIENCIA', parameter: null,
            description: 'Hallazgo ficticio de apariencia', severity: 'MEDIA' }] : [],
          evidence: [],
        }, fixed(102), randomUUID());
        inspectionIds.set(alias, created.id);
      }
    }
    assert.equal(await db.collection('inspecciones_calidad').countDocuments({}), 80);
    assert.equal(await db.collection('inspecciones_calidad').countDocuments({ resultado: 'NO_CONFORME' }), 40);

    incidentService = new IncidentWriteService({ pool }, { db });
    for (let group = 1; group <= 10; group += 1) {
      const prefix = `D${String(group).padStart(2, '0')}`;
      const created = await incidentService.create({
        originLotId: lotIds.get(`${prefix}-R1`), title: `Investigación ficticia ${prefix}`,
        type: 'CALIDAD', severity: 'MEDIA', detectedAt: at(),
        description: `Expediente ficticio ${prefix}`,
        inspectionIds: [inspectionIds.get(`${prefix}-R1`)], findings: [], evidence: [],
      }, fixed(102), randomUUID());
      incidentIds.push(created.id);
      assert.equal(created.dossierStatus, 'PENDIENTE');
    }
    const mongoEvents = (await pool.query(`SELECT count(*)::int AS n FROM eventos_sincronizacion
      WHERE motor_destino='MONGODB'`)).rows[0].n;
    assert.equal(mongoEvents, 10);
    for (let i = 0; i < mongoEvents; i += 1) {
      assert.equal(await dispatchNext(pool, 'MONGODB',
        (event, signal) => applyDossierEvent(db, event, signal)), 'applied');
    }
    assert.equal(await db.collection('expedientes_incidencias').countDocuments({}), 10);
    for (const id of incidentIds) {
      const started = await incidentService.startAnalysis(id, fixed(102), randomUUID());
      assert.equal(started.status, 'EN_ANALISIS');
    }

    const dashboard = (await pool.query(`SELECT
      (SELECT count(*)::int FROM lotes) AS lots,
      (SELECT count(*)::int FROM ordenes_produccion) AS productions,
      (SELECT count(*)::int FROM incidencias WHERE estado <> 'CERRADA') AS incidents,
      (SELECT count(*)::int FROM bloqueos_lotes WHERE activo) AS blocked`)).rows[0];
    assert.deepEqual(dashboard, { lots: 150, productions: 60, incidents: 10, blocked: 0 });
    const pending = (await pool.query(`SELECT count(*)::int AS n FROM eventos_sincronizacion
      WHERE estado <> 'COMPLETADO'`)).rows[0].n;
    assert.equal(pending, 0);

    const root = lotIds.get('D01-R1');
    const forward = await traverseLots(graph, graphDb, root, 'FORWARD', 20);
    assert.equal(forward.status, 'COMPLETO');
    const levels = forward.lots.reduce((acc, item) => {
      acc[item.depth] = (acc[item.depth] ?? 0) + 1;
      return acc;
    }, {});
    assert.deepEqual(levels, { 1: 2, 2: 4, 3: 4, 4: 2 });
    const common = await commonOrigins(graph, graphDb,
      [lotIds.get('D01-B2'), lotIds.get('D01-C2')], 20);
    assert.deepEqual(common.lots.map((item) => lotAliases.get(item.lotId)).sort(),
      ['D01-R1', 'D01-R2', 'D01-R3']);
    const toD1 = await productionPaths(graph, graphDb, root, lotIds.get('D01-D1'),
      'ALL', 20, 50);
    assert.equal(toD1.paths.length, 2);
    assert.ok(toD1.paths.every((path) => path.depth === 3));
    const toF1 = await productionPaths(graph, graphDb, root, lotIds.get('D01-F1'),
      'SHORTEST', 20, 50);
    assert.ok(toF1.paths.length >= 1);
    const toOtherGroup = await productionPaths(graph, graphDb, root,
      lotIds.get('D02-F1'), 'ALL', 20, 50);
    assert.deepEqual(toOtherGroup.paths, []);

    impactService = new ImpactService({ pool }, { db });
    const impact = await impactService.get(incidentIds[0]);
    assert.equal(impact.status, 'COMPLETO');
    assert.deepEqual(impact.summary, { originLots: 1, directLots: 2, indirectLots: 10,
      totalAffectedLots: 13, destinationCount: 4, blockedLots: 0 });
    const locationsOf = (item) => item.locationName;
    assert.deepEqual(impact.destinations.data.map(locationsOf).sort(), [
      'Ubicación ficticia SUC-01', 'Ubicación ficticia SUC-02',
      'Ubicación ficticia SUC-03', 'Ubicación ficticia SUC-04',
    ]);
    assert.equal(impact.quality.data.byLot.reduce((sum, item) => sum + item.nonConforming, 0), 4);
    const f1Stock = impact.stockByLocation.data.filter((item) => item.lotCode === 'D01-F1')
      .map((item) => [item.locationName, item.physicalQuantity]).sort();
    assert.deepEqual(f1Stock, [
      ['Ubicación ficticia SUC-01', '8.000'], ['Ubicación ficticia SUC-02', '4.000'],
      ['Ubicación ficticia UB-001', '28.000'],
    ]);
    const firstRootStock = (await pool.query(`SELECT cantidad::text AS n FROM existencias e
      JOIN lotes l ON l.id=e.lote_id WHERE l.codigo='D01-R1'`)).rows[0].n;
    assert.equal(Number(firstRootStock), 95);

    // DA-07: profundidad corta con frontera adicional es PARCIAL, no vacío válido.
    const shallow = await traverseLots(graph, graphDb, root, 'FORWARD', 1);
    assert.equal(shallow.status, 'PARCIAL');
    assert.ok(shallow.warnings.includes('DEPTH_LIMIT'));
    const shallowImpact = await impactService.get(incidentIds[0], 1);
    assert.equal(shallowImpact.status, 'PARCIAL');
    assert.ok(shallowImpact.metadata.warnings.some((item) => item.code === 'DEPTH_LIMIT'));

    // DA-06: bloqueo manual de descendiente verificado; cierre no libera.
    blockService = new BlockWriteService({ pool });
    const manual = await blockService.block(incidentIds[0], [lotIds.get('D01-F1')],
      'Dependencia potencial verificada', fixed(102), randomUUID());
    assert.equal(manual.length, 1);
    await assert.rejects(registrarDistribucion({
      originLocationId: locationIds.get('UB-001'), destinationLocationId: locationIds.get('SUC-05'),
      distributedAt: at(), items: [{ lotId: lotIds.get('D01-F1'), quantity: '1.000' }],
      actorId: fixed(101), idempotencyKey: randomUUID(),
    }, deps), /LOT_BLOCKED/);
    const closed = await incidentService.close(incidentIds[0],
      'Evaluación documentada ficticia', fixed(102), randomUUID());
    assert.equal(closed.status, 'CERRADA');
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM bloqueos_lotes
      WHERE lote_id=$1 AND activo`, [lotIds.get('D01-F1')])).rows[0].n, 1);
    await blockService.release(manual[0].id, 'Retiro ficticio tras cierre', fixed(102), randomUUID());
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM bloqueos_lotes
      WHERE lote_id=$1 AND activo`, [lotIds.get('D01-F1')])).rows[0].n, 0);

    process.stdout.write(`DEMO150_ACTUAL=${JSON.stringify({
      ...sqlCounts, graphNodes: 279, graphEdges: 540,
      inspections: 80, nonConforming: 40, incidents: 10, dossiers: 10,
      descendantLevels: levels, commonOrigins: 3, pathsToD1: 2,
      f1MinPathDepth: toF1.paths[0]?.depth ?? null, impactLots: 13, destinations: 4,
      depthOne: 'PARCIAL', verifiedBlock: true, closeKeepsBlock: true,
    })}\n`);
  } finally {
    try {
      if (incidentService) await incidentService.onModuleDestroy();
      if (blockService) await blockService.onModuleDestroy();
      if (impactService) await impactService.onModuleDestroy();
      await graph.executeQuery('MATCH (n) WHERE n.id IN $ids DETACH DELETE n',
        { ids: [...graphIds] }, { database: graphDb });
      await graph.close();
      if (db) await db.dropDatabase();
      await mongo.close();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    } catch (error) {
      process.stderr.write(`Limpieza DEMO-150: ${String(error)}\n`);
    }
  }
});
