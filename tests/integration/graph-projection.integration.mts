import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import neo4j from 'neo4j-driver';
import { applyGraphEvent } from '../../backend/src/integration/handlers/neo4j/projection.mts';
import { PermanentDeliveryError, type Delivery } from '../../backend/src/integration/outbox/dispatcher.mts';

test('PG-01..04: catálogos, recepción, producción múltiple, replay y rollback', async () => {
  for (const key of ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) assert.ok(process.env[key]);
  const driver = neo4j.driver(process.env.NEO4J_URI!, neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!));
  const database = process.env.NEO4J_DATABASE ?? 'neo4j';
  const ids = { supplier: randomUUID(), product: randomUUID(), outputProduct: randomUUID(), location: randomUUID(),
    input: randomUUID(), process: randomUUID(), output1: randomUUID(), output2: randomUUID() };
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
  try {
    await applyGraphEvent(driver, database, supplier, signal);
    await applyGraphEvent(driver, database, product, signal);
    await applyGraphEvent(driver, database, outputProduct, signal);
    await applyGraphEvent(driver, database, location, signal);
    await assert.rejects(applyGraphEvent(driver, database, production, signal), PermanentDeliveryError);
    const before = await driver.executeQuery('MATCH (p:Proceso {id:$id}) RETURN count(p) AS n',
      { id: ids.process }, { database });
    assert.equal(before.records[0]!.get('n').toNumber(), 0);
    await applyGraphEvent(driver, database, receipt, signal);
    await applyGraphEvent(driver, database, receipt, signal);
    await applyGraphEvent(driver, database, production, signal);
    await applyGraphEvent(driver, database, production, signal);
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
  } finally {
    // Eliminar exclusivamente los nodos UUID que esta prueba generó en el motor aislado.
    await driver.executeQuery(`MATCH (n) WHERE n.id IN $ids DETACH DELETE n`, { ids: Object.values(ids) }, { database });
    await driver.close();
  }
});
