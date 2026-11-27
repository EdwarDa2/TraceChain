import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import neo4j from 'neo4j-driver';
import { applyGraphEvent } from '../../backend/src/integration/handlers/neo4j/projection.mts';
import { productionPaths, traverseLots } from '../../backend/src/database/neo4j/traversal.mts';
import { PermanentDeliveryError, type Delivery } from '../../backend/src/integration/outbox/dispatcher.mts';

test('PG-01..04: catálogos, recepción, producción múltiple, replay y rollback', async () => {
  for (const key of ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) assert.ok(process.env[key]);
  const driver = neo4j.driver(process.env.NEO4J_URI!, neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!));
  const database = process.env.NEO4J_DATABASE ?? 'neo4j';
  const ids = { supplier: randomUUID(), product: randomUUID(), outputProduct: randomUUID(),
    location: randomUUID(), destination: randomUUID(), distribution: randomUUID(),
    input: randomUUID(), process: randomUUID(), process2: randomUUID(),
    output1: randomUUID(), output2: randomUUID(), output3: randomUUID() };
  const signal = new AbortController().signal;
  const event = (eventType: Delivery['eventType'], entityType: string, entityId: string,
    payload: Record<string, unknown>): Delivery => ({
    eventId: randomUUID(), sequence: '1', eventType, entityType, entityId, destination: 'NEO4J',
    occurredAt: new Date().toISOString(), payloadVersion: 1, payload,
  });
  const supplier = event('PROVEEDOR_CREADO', 'SUPPLIER', ids.supplier, {
    supplier: { id: ids.supplier, code: 'P-TEST', name: 'Proveedor ficticio', active: true },
  });
  const product = event('PRODUCTO_CREADO', 'PRODUCT', ids.product, {
    product: { id: ids.product, code: 'PR-TEST', name: 'Producto ficticio', active: true, type: 'MATERIA_PRIMA', unit: 'KG' },
  });
  const outputProduct = event('PRODUCTO_CREADO', 'PRODUCT', ids.outputProduct, {
    product: { id: ids.outputProduct, code: 'PR-TEST-OUTPUT', name: 'Producto final ficticio',
      active: true, type: 'TERMINADO', unit: 'UNIDAD' },
  });
  const location = event('UBICACION_CREADA', 'LOCATION', ids.location, {
    location: { id: ids.location, code: 'UB-TEST', name: 'Ubicación ficticia', active: true, type: 'ALMACEN' },
  });
  const destination = event('UBICACION_CREADA', 'LOCATION', ids.destination, {
    location: { id: ids.destination, code: 'SUC-TEST', name: 'Sucursal ficticia', active: true, type: 'SUCURSAL' },
  });
  const receivedAt = '2026-11-25T16:00:00Z';
  const receipt = event('LOTE_RECIBIDO', 'LOT', ids.input, {
    lot: { id: ids.input, code: 'MP-TEST', productId: ids.product, originType: 'RECEPCION', originAt: receivedAt },
    supplierId: ids.supplier,
  });
  const outputs = [ids.output1, ids.output2].map((lotId, index) => ({
    id: randomUUID(), lot: { id: lotId, code: `LP-TEST-${index}`, productId: ids.outputProduct,
      originType: 'PRODUCCION', originAt: receivedAt }, quantity: '2.000', unit: 'UNIDAD',
  }));
  const production = event('PRODUCCION_REGISTRADA', 'PRODUCTION', ids.process, {
    process: { id: ids.process, code: 'OP-000001', name: 'Proceso ficticio',
      locationId: ids.location, producedAt: receivedAt },
    inputs: [{ id: randomUUID(), lotId: ids.input, quantity: '4.000', unit: 'KG' }],
    outputs,
  });
  const distribution = event('DISTRIBUCION_REGISTRADA', 'DISTRIBUTION', ids.distribution, {
    distribution: { id: ids.distribution, code: 'DIST-000001', distributedAt: receivedAt,
      originLocationId: ids.location, destinationLocationId: ids.destination },
    items: [{ id: randomUUID(), lotId: ids.output1, quantity: '1.000', unit: 'UNIDAD' }],
  });
  const convergent = event('PRODUCCION_REGISTRADA', 'PRODUCTION', ids.process2, {
    process: { id: ids.process2, code: 'OP-000002', name: 'Convergencia ficticia',
      locationId: ids.location, producedAt: receivedAt },
    inputs: [ids.output1, ids.output2].map((lotId) => ({
      id: randomUUID(), lotId, quantity: '1.000', unit: 'UNIDAD',
    })),
    outputs: [{ id: randomUUID(), lot: { id: ids.output3, code: 'LP-TEST-3',
      productId: ids.outputProduct, originType: 'PRODUCCION', originAt: receivedAt },
    quantity: '1.000', unit: 'UNIDAD' }],
  });
  try {
    await applyGraphEvent(driver, database, supplier, signal);
    await applyGraphEvent(driver, database, product, signal);
    await applyGraphEvent(driver, database, outputProduct, signal);
    await applyGraphEvent(driver, database, location, signal);
    await applyGraphEvent(driver, database, destination, signal);
    await assert.rejects(applyGraphEvent(driver, database, production, signal), PermanentDeliveryError);
    const before = await driver.executeQuery('MATCH (p:Proceso {id:$id}) RETURN count(p) AS n',
      { id: ids.process }, { database });
    assert.equal(before.records[0]!.get('n').toNumber(), 0);
    await applyGraphEvent(driver, database, receipt, signal);
    await applyGraphEvent(driver, database, receipt, signal);
    await applyGraphEvent(driver, database, production, signal);
    await applyGraphEvent(driver, database, production, signal);
    await applyGraphEvent(driver, database, distribution, signal);
    await applyGraphEvent(driver, database, distribution, signal);
    await applyGraphEvent(driver, database, convergent, signal);
    await applyGraphEvent(driver, database, convergent, signal);
    const result = await driver.executeQuery(`MATCH (s:Proveedor {id:$supplier})-[a:SUMINISTRA]->(l:Lote {id:$input})
      -[b:UTILIZADO_EN]->(p:Proceso {id:$process})-[c:GENERA]->(o:Lote)
      RETURN count(DISTINCT a) AS supplies, count(DISTINCT b) AS inputs,
        count(DISTINCT c) AS outputs, count(DISTINCT o) AS lots, collect(c.cantidad_milesimas) AS quantities`, {
      supplier: ids.supplier, input: ids.input, process: ids.process,
    }, { database });
    const row = result.records[0]!;
    assert.equal(row.get('supplies').toNumber(), 1);
    assert.equal(row.get('inputs').toNumber(), 1);
    assert.equal(row.get('outputs').toNumber(), 2);
    assert.equal(row.get('lots').toNumber(), 2);
    assert.ok(row.get('quantities').every((value: { toString(): string }) => value.toString() === '2000'));
    const destinations = await driver.executeQuery(`MATCH (l:Lote {id:$id})-[detail:INCLUIDO_EN]->(d:Distribucion)
      -[:ENTREGADO_A]->(u:Ubicacion) MATCH (d)-[:SALE_DE]->(:Ubicacion)
      RETURN count(detail) AS n, collect(u.id) AS ids`, { id: ids.output1 }, { database });
    assert.equal(destinations.records[0]!.get('n').toNumber(), 1);
    assert.deepEqual(destinations.records[0]!.get('ids'), [ids.destination]);
    const all = await productionPaths(driver, database, ids.input, ids.output3, 'ALL');
    const shortest = await productionPaths(driver, database, ids.input, ids.output3, 'SHORTEST');
    const limited = await productionPaths(driver, database, ids.input, ids.output3, 'ALL', 10, 1);
    const forward = await traverseLots(driver, database, ids.input, 'FORWARD');
    assert.equal(all.status, 'COMPLETO');
    assert.equal(all.paths.length, 2);
    assert.ok(all.paths.every((path) => path.depth === 2));
    assert.equal(shortest.paths.length, 1);
    assert.equal(limited.status, 'PARCIAL');
    assert.deepEqual(limited.warnings, ['PATH_LIMIT']);
    assert.equal(forward.lots.filter((lot) => lot.lotId === ids.output3).length, 1);
    assert.equal(forward.lots.find((lot) => lot.lotId === ids.output3)?.depth, 2);
  } finally {
    // Eliminar exclusivamente los nodos UUID que esta prueba generó en el motor aislado.
    await driver.executeQuery(`MATCH (n) WHERE n.id IN $ids DETACH DELETE n`, { ids: Object.values(ids) }, { database });
    await driver.close();
  }
});
