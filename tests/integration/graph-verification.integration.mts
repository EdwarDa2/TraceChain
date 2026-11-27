import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import neo4j from 'neo4j-driver';
import { verifyDescendant } from '../../backend/src/database/neo4j/verification.mts';
import { applyGraphEvent } from '../../backend/src/integration/handlers/neo4j/projection.mts';
import type { Delivery } from '../../backend/src/integration/outbox/dispatcher.mts';

test('RN-118: positivo Neo aun pendiente; negativo solo si cola SQL Neo completa', async () => {
  for (const name of ['DATABASE_URL', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) assert.ok(process.env[name]);
  const schema = `graph_verify_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  const graph = neo4j.driver(process.env.NEO4J_URI!, neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!));
  const database = process.env.NEO4J_DATABASE ?? 'neo4j';
  const ids = { supplier: randomUUID(), product: randomUUID(), root: randomUUID(),
    process: randomUUID(), child: randomUUID(), absent: randomUUID(), pending: randomUUID() };
  const at = '2026-11-25T16:00:00Z';
  const emit = async (type: Delivery['eventType'], entityType: string, entityId: string,
    payload: Record<string, unknown>) => applyGraphEvent(graph, database, {
    eventId: randomUUID(), sequence: '1', eventType: type, entityType, entityId,
    destination: 'NEO4J', occurredAt: at, payloadVersion: 1, payload,
  }, new AbortController().signal);
  try {
    await pool.query('CREATE TABLE usuarios (id uuid PRIMARY KEY)');
    await pool.query(await readFile(new URL('../../database/relational/schema/006_integration.sql', import.meta.url), 'utf8'));
    await emit('PROVEEDOR_CREADO', 'SUPPLIER', ids.supplier,
      { supplier: { id: ids.supplier, code: 'PROV-TEST', name: 'Proveedor ficticio', active: true } });
    await emit('PRODUCTO_CREADO', 'PRODUCT', ids.product,
      { product: { id: ids.product, code: 'PRD-TEST', name: 'Producto ficticio',
        active: true, type: 'MATERIA_PRIMA', unit: 'KG' } });
    await emit('LOTE_RECIBIDO', 'LOT', ids.root, { lot: { id: ids.root, code: 'MP-TEST',
      productId: ids.product, originType: 'RECEPCION', originAt: at }, supplierId: ids.supplier });
    await emit('LOTE_RECIBIDO', 'LOT', ids.absent, { lot: { id: ids.absent, code: 'MP-INDEPENDIENTE',
      productId: ids.product, originType: 'RECEPCION', originAt: at }, supplierId: ids.supplier });
    await emit('PRODUCCION_REGISTRADA', 'PRODUCTION', ids.process, {
      process: { id: ids.process, code: 'OP-000001', name: 'Proceso ficticio', locationId: randomUUID(), producedAt: at },
      inputs: [{ id: randomUUID(), lotId: ids.root, quantity: '1.000', unit: 'KG' }],
      outputs: [{ id: randomUUID(), lot: { id: ids.child, code: 'LP-TEST',
        productId: ids.product, originType: 'PRODUCCION', originAt: at }, quantity: '1.000', unit: 'KG' }],
    });
    await pool.query(`INSERT INTO eventos_sincronizacion
      (id,tipo_evento,entidad_id,tipo_entidad,motor_destino,payload)
      VALUES ($1,'LOTE_RECIBIDO',$2,'LOT','NEO4J',$3::jsonb)`,
    [ids.pending, ids.root, JSON.stringify({ payloadVersion: 1, payload: {} })]);
    assert.equal(await verifyDescendant(pool, graph, database, ids.root, ids.child), 'YES');
    assert.equal(await verifyDescendant(pool, graph, database, ids.root, ids.absent), 'UNKNOWN');
    await pool.query(`UPDATE eventos_sincronizacion SET estado='COMPLETADO', processed_at=now() WHERE id=$1`, [ids.pending]);
    assert.equal(await verifyDescendant(pool, graph, database, ids.root, ids.absent), 'NO');
  } finally {
    await graph.executeQuery('MATCH (n) WHERE n.id IN $ids DETACH DELETE n',
      { ids: Object.values(ids) }, { database });
    await graph.close();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
