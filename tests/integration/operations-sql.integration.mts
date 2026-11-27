import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createSqlOperationsDeps } from '../../backend/src/database/postgres/operations-repository.mts';
import {
  registrarRecepcion, registrarProduccion, registrarDistribucion,
} from '../../backend/src/modules/operations/operations.mts';

test('SQL real: recepción→producción→distribución, movimientos, outbox y replay atómicos', async () => {
  assert.ok(process.env.DATABASE_URL);
  const schema = `operations_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`, max: 8 });
  const ids = { actor: randomUUID(), supplier: randomUUID(), rawProduct: randomUUID(),
    finishedProduct: randomUUID(), plant: randomUUID(), branch: randomUUID() };
  const time = '2026-11-25T20:00:00Z';
  try {
    for (const version of ['001_catalogs', '002_inventory', '003_production',
      '004_distribution', '005_incidents', '006_integration', '007_views_indexes', '008_operation_codes']) {
      const migration = await readFile(
        new URL(`../../database/relational/schema/${version}.sql`, import.meta.url), 'utf8');
      await pool.query(migration);
    }
    await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol)
      VALUES ($1,'Operador ficticio','operador-prueba@example.invalid','hash-solo-prueba','OPERADOR')`, [ids.actor]);
    await pool.query(`INSERT INTO proveedores(id,codigo,nombre) VALUES($1,'PROV-TEST','Proveedor ficticio')`, [ids.supplier]);
    await pool.query(`INSERT INTO productos(id,codigo,nombre,tipo,unidad_medida) VALUES
      ($1,'PRD-RAW','Materia prima ficticia','MATERIA_PRIMA','KG'),
      ($2,'PRD-FINAL','Producto ficticio','TERMINADO','UNIDAD')`, [ids.rawProduct, ids.finishedProduct]);
    await pool.query(`INSERT INTO ubicaciones(id,codigo,nombre,tipo) VALUES
      ($1,'UB-TEST','Planta ficticia','PLANTA_PRODUCCION'),
      ($2,'SUC-TEST','Sucursal ficticia','SUCURSAL')`, [ids.plant, ids.branch]);
    const deps = createSqlOperationsDeps(pool);
    const receipt = {
      code: 'MP-TEST', productId: ids.rawProduct, supplierId: ids.supplier,
      locationId: ids.plant, quantity: '10.000', receivedAt: time,
      expirationDate: null, actorId: ids.actor, idempotencyKey: randomUUID(),
    };
    const first = await registrarRecepcion(receipt, deps);
    assert.ok(first.id);
    assert.deepEqual(await registrarRecepcion(receipt, deps), first);
    const production = await registrarProduccion({
      name: 'Producción ficticia', locationId: ids.plant, producedAt: '2026-11-25T20:01:00Z',
      inputs: [{ lotId: first.id!, quantity: '4.000' }],
      outputs: [{ code: 'LP-TEST', productId: ids.finishedProduct,
        quantity: '3.000', expirationDate: null }],
      actorId: ids.actor, idempotencyKey: randomUUID(),
    }, deps);
    assert.ok(production.id);
    const output = (await pool.query<{ id: string }>("SELECT id FROM lotes WHERE codigo='LP-TEST'")).rows[0]!.id;
    const distribution = await registrarDistribucion({
      originLocationId: ids.plant, destinationLocationId: ids.branch,
      distributedAt: '2026-11-25T20:02:00Z', items: [{ lotId: output, quantity: '2.000' }],
      actorId: ids.actor, idempotencyKey: randomUUID(),
    }, deps);
    assert.ok(distribution.id);
    const stocks = await pool.query<{ codigo: string; ubicacion_id: string; cantidad: string }>(`
      SELECT l.codigo,e.ubicacion_id,e.cantidad::text AS cantidad
      FROM existencias e JOIN lotes l ON l.id=e.lote_id ORDER BY l.codigo,e.ubicacion_id`);
    assert.deepEqual(stocks.rows.map(({ codigo, ubicacion_id, cantidad }) =>
      [codigo, ubicacion_id === ids.plant ? 'planta' : 'sucursal', cantidad]).sort(), [
      ['LP-TEST', 'planta', '1.000'], ['LP-TEST', 'sucursal', '2.000'],
      ['MP-TEST', 'planta', '6.000'],
    ]);
    const counts = await pool.query(`SELECT
      (SELECT count(*)::int FROM lotes) AS lots,
      (SELECT count(*)::int FROM ordenes_produccion) AS productions,
      (SELECT count(*)::int FROM consumos_produccion) AS inputs,
      (SELECT count(*)::int FROM resultados_produccion) AS outputs,
      (SELECT count(*)::int FROM distribuciones) AS distributions,
      (SELECT count(*)::int FROM detalle_distribuciones) AS details,
      (SELECT count(*)::int FROM movimientos) AS movements,
      (SELECT count(*)::int FROM eventos_sincronizacion) AS events,
      (SELECT count(*)::int FROM solicitudes_idempotentes) AS requests`);
    assert.deepEqual(counts.rows[0], { lots: 2, productions: 1, inputs: 1,
      outputs: 1, distributions: 1, details: 1, movements: 5, events: 3, requests: 3 });
    const events = await pool.query<{ tipo_evento: string; entidad_id: string; payload: {
      payload: Record<string, unknown> } }>(`SELECT tipo_evento,entidad_id,payload
      FROM eventos_sincronizacion ORDER BY secuencia`);
    assert.deepEqual(events.rows.map(({ tipo_evento }) => tipo_evento),
      ['LOTE_RECIBIDO', 'PRODUCCION_REGISTRADA', 'DISTRIBUCION_REGISTRADA']);
    assert.deepEqual(events.rows.map(({ entidad_id }) => entidad_id), [first.id, production.id, distribution.id]);
    const produced = events.rows[1]!.payload.payload;
    assert.equal((produced.process as { code: string }).code, 'OP-000001');
    assert.equal((produced.outputs as { lot: { id: string }; unit: string }[])[0]!.lot.id, output);
    assert.equal((produced.outputs as { unit: string }[])[0]!.unit, 'UNIDAD');
    const transferred = events.rows[2]!.payload.payload;
    assert.equal((transferred.distribution as { code: string }).code, 'DIST-000001');
    assert.equal((transferred.items as { lotId: string; unit: string }[])[0]!.lotId, output);
    assert.equal((transferred.items as { unit: string }[])[0]!.unit, 'UNIDAD');
    await assert.rejects(registrarDistribucion({
      originLocationId: ids.plant, destinationLocationId: ids.branch,
      distributedAt: '2026-11-25T20:03:00Z', items: [{ lotId: output, quantity: '99.000' }],
      actorId: ids.actor, idempotencyKey: randomUUID(),
    }, deps), /INSUFFICIENT_STOCK/);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM distribuciones')).rows[0].n, 1);
    console.log(`OPERATIONS_SQL_ACTUAL=${JSON.stringify(counts.rows[0])}`);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
