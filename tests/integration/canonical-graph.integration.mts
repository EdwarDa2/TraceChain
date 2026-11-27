import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import neo4j from 'neo4j-driver';
import { applyGraphEvent } from '../../backend/src/integration/handlers/neo4j/projection.mts';
import {
  traverseLots, commonOrigins, historicalDestinations, productionPaths,
  genealogy, originSuppliers, productiveProcesses,
} from '../../backend/src/database/neo4j/traversal.mts';
import type { Delivery } from '../../backend/src/integration/outbox/dispatcher.mts';

test('proyección aislada de topología canónica: 9 lotes, niveles, comunes y destinos reales', async () => {
  for (const name of ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) assert.ok(process.env[name]);
  const driver = neo4j.driver(process.env.NEO4J_URI!, neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!));
  const database = process.env.NEO4J_DATABASE ?? 'neo4j';
  const signal = new AbortController().signal;
  const aliases = ['PROV-001', 'PROV-002', 'PROV-003', ...Array.from({ length: 7 }, (_, n) => `PRD-00${n + 1}`),
    'UB-001', 'SUC-01', 'SUC-02', 'SUC-03',
    'MP-001', 'MP-002', 'MP-003', 'MP-004', 'LP-001', 'LP-002', 'LP-003', 'LP-004', 'LP-005',
    ...Array.from({ length: 5 }, (_, n) => `OP-00000${n + 1}`),
    'DIST-000001', 'DIST-000002', 'DIST-000003'];
  const ids = Object.fromEntries(aliases.map((name) => [name, randomUUID()])) as Record<string, string>;
  const get = (name: string) => ids[name]!;
  const at = '2026-11-25T16:00:00Z';
  const emit = async (eventType: Delivery['eventType'], entityType: string, entityId: string,
    payload: Record<string, unknown>) => applyGraphEvent(driver, database, {
    eventId: randomUUID(), sequence: '1', eventType, entityType, entityId, destination: 'NEO4J',
    occurredAt: at, payloadVersion: 1, payload,
  }, signal);
  const unit = (product: string) => ['PRD-006', 'PRD-007'].includes(product) ? 'UNIDAD' : 'KG';
  try {
    for (const name of ['PROV-001', 'PROV-002', 'PROV-003']) {
      await emit('PROVEEDOR_CREADO', 'SUPPLIER', get(name),
        { supplier: { id: get(name), code: name, name: `Proveedor ficticio ${name}`, active: true } });
    }
    for (const name of aliases.filter((alias) => alias.startsWith('PRD-'))) {
      const type = Number(name.slice(-3)) <= 3 ? 'MATERIA_PRIMA'
        : Number(name.slice(-3)) <= 5 ? 'INTERMEDIO' : 'TERMINADO';
      await emit('PRODUCTO_CREADO', 'PRODUCT', get(name),
        { product: { id: get(name), code: name, name: `Producto ficticio ${name}`,
          active: true, type, unit: unit(name) } });
    }
    for (const name of ['UB-001', 'SUC-01', 'SUC-02', 'SUC-03']) {
      await emit('UBICACION_CREADA', 'LOCATION', get(name),
        { location: { id: get(name), code: name, name: name === 'SUC-01' ? 'Centro'
          : name === 'SUC-02' ? 'Norte' : name === 'SUC-03' ? 'Sur' : 'Planta',
          active: true, type: name === 'UB-001' ? 'PLANTA_PRODUCCION' : 'SUCURSAL' } });
    }
    const raw = [
      ['MP-001', 'PRD-001', 'PROV-001'], ['MP-002', 'PRD-002', 'PROV-002'],
      ['MP-003', 'PRD-003', 'PROV-003'], ['MP-004', 'PRD-001', 'PROV-001'],
    ];
    for (const [lot, product, supplier] of raw) {
      await emit('LOTE_RECIBIDO', 'LOT', get(lot!), { lot: {
        id: get(lot!), code: lot, productId: get(product!), originType: 'RECEPCION', originAt: at,
      }, supplierId: get(supplier!) });
    }
    const productions = [
      { inputs: ['MP-001', 'MP-002', 'MP-003'], output: 'LP-001', product: 'PRD-004' },
      { inputs: ['MP-001', 'MP-002'], output: 'LP-002', product: 'PRD-005' },
      { inputs: ['LP-001'], output: 'LP-003', product: 'PRD-006' },
      { inputs: ['LP-002'], output: 'LP-004', product: 'PRD-007' },
      { inputs: ['MP-004'], output: 'LP-005', product: 'PRD-006' },
    ];
    for (const [index, process] of productions.entries()) {
      const code = `OP-00000${index + 1}`;
      await emit('PRODUCCION_REGISTRADA', 'PRODUCTION', get(code), {
        process: { id: get(code), code, name: `Proceso ficticio ${code}`, locationId: get('UB-001'), producedAt: at },
        inputs: process.inputs.map((lot) => ({ id: randomUUID(), lotId: get(lot),
          quantity: '1.000', unit: unit(lot === 'LP-001' || lot === 'LP-002' ? 'PRD-004' : 'PRD-001') })),
        outputs: [{ id: randomUUID(), lot: { id: get(process.output), code: process.output,
          productId: get(process.product), originType: 'PRODUCCION', originAt: at },
        quantity: '1.000', unit: unit(process.product) }],
      });
    }
    for (const [index, lot, destination] of [
      ['1', 'LP-003', 'SUC-01'], ['2', 'LP-004', 'SUC-02'], ['3', 'LP-005', 'SUC-03'],
    ]) {
      const code = `DIST-00000${index}`;
      await emit('DISTRIBUCION_REGISTRADA', 'DISTRIBUTION', get(code), {
        distribution: { id: get(code), code, distributedAt: at,
          originLocationId: get('UB-001'), destinationLocationId: get(destination) },
        items: [{ id: randomUUID(), lotId: get(lot), quantity: '1.000', unit: 'UNIDAD' }],
      });
    }
    const forward = await traverseLots(driver, database, get('MP-001'), 'FORWARD', 10);
    const short = await traverseLots(driver, database, get('MP-001'), 'FORWARD', 1);
    const backward = await traverseLots(driver, database, get('LP-003'), 'BACKWARD', 10);
    const common = await commonOrigins(driver, database, [get('LP-003'), get('LP-004')]);
    const destinations = await historicalDestinations(driver, database,
      [get('MP-001'), ...forward.lots.map((lot) => lot.lotId)]);
    const shortest = await productionPaths(driver, database, get('MP-001'), get('LP-003'), 'SHORTEST');
    const absent = await productionPaths(driver, database, get('MP-001'), get('LP-005'), 'SHORTEST');
    const combined = await genealogy(driver, database, get('LP-001'));
    const suppliers = await originSuppliers(driver, database, [get('LP-001'), ...backward.lots.map((lot) => lot.lotId)]);
    const processes = await productiveProcesses(driver, database,
      [get('MP-001'), ...forward.lots.map((lot) => lot.lotId)]);
    const edges = await driver.executeQuery(`MATCH (a)-[r]->(b)
      WHERE a.id IN $ids AND b.id IN $ids
      RETURN type(r) AS kind, count(r) AS n ORDER BY kind`,
    { ids: Object.values(ids) }, { database });
    const relationshipsByType = Object.fromEntries(edges.records.map((record) =>
      [record.get('kind') as string, record.get('n').toNumber() as number]));
    const labels = await driver.executeQuery(`MATCH (n) WHERE n.id IN $ids
      RETURN labels(n)[0] AS label, count(n) AS n ORDER BY label`,
    { ids: Object.values(ids) }, { database });
    const nodesByType = Object.fromEntries(labels.records.map((record) =>
      [record.get('label') as string, record.get('n').toNumber() as number]));
    const names = (list: { lotId: string }[]) => list.map(({ lotId }) =>
      Object.keys(ids).find((key) => ids[key] === lotId)!).sort();
    const actual = {
      fixtureType: 'proyeccion_neo4j_controlada_no_integracion_multimodelo',
      nodesByType,
      nodes: Object.values(nodesByType).reduce((sum, value) => sum + value, 0),
      relationshipsByType,
      relationships: Object.values(relationshipsByType).reduce((sum, value) => sum + value, 0),
      lots: nodesByType.Lote ?? 0,
      processes: nodesByType.Proceso ?? 0,
      distributions: nodesByType.Distribucion ?? 0,
      forward: names(forward.lots),
      forwardDepths: Object.fromEntries(forward.lots.map((lot) =>
        [Object.keys(ids).find((key) => ids[key] === lot.lotId), lot.depth])),
      backward: names(backward.lots),
      common: names(common.lots),
      destinationNames: [...new Set(destinations.map((destination) => destination.locationName))].sort(),
      forwardStatus: forward.status, shortStatus: short.status, shortWarnings: short.warnings,
      shortestDepth: shortest.paths[0]?.depth ?? null, shortestStatus: shortest.status,
      absentPaths: absent.paths.length, absentStatus: absent.status,
      suppliers: suppliers.map((item) => item.code).sort(),
      relevantProcesses: processes.map((item) => item.code).sort(),
      genealogyLp001Forward: names(combined.forward), genealogyLp001Backward: names(combined.backward),
      unsupportedHere: ['PostgreSQL stock', 'MongoDB inspections', 'incidents', 'HTTP API', 'benchmark'],
    };
    assert.deepEqual(actual.forward, ['LP-001', 'LP-002', 'LP-003', 'LP-004']);
    assert.deepEqual(actual.common, ['MP-001', 'MP-002']);
    assert.deepEqual(actual.destinationNames, ['Centro', 'Norte']);
    assert.equal(actual.nodes, 31);
    assert.deepEqual(actual.nodesByType, {
      Distribucion: 3, Lote: 9, Proceso: 5, Producto: 7, Proveedor: 3, Ubicacion: 4,
    });
    assert.deepEqual(actual.relationshipsByType, {
      CORRESPONDE_A: 9, ENTREGADO_A: 3, GENERA: 5, INCLUIDO_EN: 3,
      SALE_DE: 3, SUMINISTRA: 4, UTILIZADO_EN: 8,
    });
    assert.equal(actual.relationships, 35);
    assert.equal(actual.forwardStatus, 'COMPLETO');
    assert.equal(actual.shortStatus, 'PARCIAL');
    assert.deepEqual(actual.shortWarnings, ['DEPTH_LIMIT']);
    assert.equal(actual.shortestDepth, 2);
    assert.equal(actual.absentPaths, 0);
    assert.equal(actual.absentStatus, 'COMPLETO');
    assert.deepEqual(actual.suppliers, ['PROV-001', 'PROV-002', 'PROV-003']);
    assert.deepEqual(actual.relevantProcesses, ['OP-000001', 'OP-000002', 'OP-000003', 'OP-000004']);
    assert.deepEqual(actual.genealogyLp001Backward, ['MP-001', 'MP-002', 'MP-003']);
    assert.equal(forward.lots.some((lot) => lot.lotId === get('LP-005')), false);
    assert.equal(backward.lots.some((lot) => lot.lotId === get('LP-004')), false);
    console.log(`GRAPH_PROJECTION_ACTUAL=${JSON.stringify(actual)}`);
    if (process.env.TRACECHAIN_EVIDENCE_PATH) {
      await writeFile(process.env.TRACECHAIN_EVIDENCE_PATH, JSON.stringify(actual, null, 2) + '\n');
    }
  } finally {
    await driver.executeQuery('MATCH (n) WHERE n.id IN $ids DETACH DELETE n',
      { ids: Object.values(ids) }, { database });
    await driver.close();
  }
});
