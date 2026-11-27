import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import process from 'node:process';
import { URL } from 'node:url';
import pg from 'pg';
import { createSqlOperationsDeps } from '../../backend/dist/database/postgres/operations-repository.mjs';
import { registrarRecepcion, registrarDistribucion } from '../../backend/dist/modules/operations/operations.mjs';
import { BlockWriteService } from '../../backend/dist/modules/lot-blocks/block-write.service.js';

test('SQL real: consumo concurrente, idempotencia en carrera y bloqueo vs distribución', async () => {
  for (const name of ['DATABASE_URL', 'MONGODB_URI', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    assert.ok(process.env[name], `falta ${name}`);
  }
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
  process.env.JWT_SECRET = 'clave-ficticia-concurrencia-para-pruebas-12345';
  const schema = `concurrency_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`, max: 12 });
  const ids = { operator: randomUUID(), analyst: randomUUID(), supplier: randomUUID(),
    raw: randomUUID(), finished: randomUUID(), plant: randomUUID(), branchA: randomUUID(),
    branchB: randomUUID(), incident: randomUUID() };
  let blocks;
  try {
    for (const version of ['001_catalogs', '002_inventory', '003_production',
      '004_distribution', '005_incidents', '006_integration', '007_views_indexes', '008_operation_codes']) {
      await pool.query(await readFile(
        new URL(`../../database/relational/schema/${version}.sql`, import.meta.url), 'utf8'));
    }
    await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol) VALUES
      ($1,'Operador ficticio','op-race@example.invalid','hash-solo-prueba','OPERADOR'),
      ($2,'Analista ficticio','qa-race@example.invalid','hash-solo-prueba','ANALISTA_CALIDAD')`,
    [ids.operator, ids.analyst]);
    await pool.query('INSERT INTO proveedores(id,codigo,nombre) VALUES($1,$2,$3)',
      [ids.supplier, 'PROV-RACE', 'Proveedor ficticio']);
    await pool.query(`INSERT INTO productos(id,codigo,nombre,tipo,unidad_medida) VALUES
      ($1,'RAW-RACE','Materia prima ficticia','MATERIA_PRIMA','KG'),
      ($2,'FIN-RACE','Producto ficticio','TERMINADO','UNIDAD')`,
    [ids.raw, ids.finished]);
    await pool.query(`INSERT INTO ubicaciones(id,codigo,nombre,tipo) VALUES
      ($1,'UB-RACE','Planta ficticia','PLANTA_PRODUCCION'),
      ($2,'SUC-A','Sucursal A ficticia','SUCURSAL'),
      ($3,'SUC-B','Sucursal B ficticia','SUCURSAL')`,
    [ids.plant, ids.branchA, ids.branchB]);
    const deps = createSqlOperationsDeps(pool, () => '2026-11-25T21:00:00.000Z');
    const receive = async (code) => (await registrarRecepcion({
      code, productId: ids.raw, supplierId: ids.supplier, locationId: ids.plant,
      quantity: '100.000', receivedAt: '2026-11-25T20:00:00Z', expirationDate: null,
      actorId: ids.operator, idempotencyKey: randomUUID(),
    }, deps)).id;
    const [raceLot, idemLot, blockLot] = await Promise.all([
      receive('MP-RACE1'), receive('MP-RACE2'), receive('MP-RACE3'),
    ]);
    const stockOf = async (lotId) => String((await pool.query(
      'SELECT cantidad::text AS cantidad FROM existencias WHERE lote_id=$1 AND ubicacion_id=$2',
      [lotId, ids.plant])).rows[0].cantidad);

    // TP-16 / CP-18: 70 y 50 sobre 100; solo una operación se confirma.
    const distribute = (lotId, quantity, destination, at, key) => registrarDistribucion({
      originLocationId: ids.plant, destinationLocationId: destination,
      distributedAt: at, items: [{ lotId, quantity }],
      actorId: ids.operator, idempotencyKey: key,
    }, deps);
    const race = await Promise.allSettled([
      distribute(raceLot, '70.000', ids.branchA, '2026-11-25T20:01:00Z', randomUUID()),
      distribute(raceLot, '50.000', ids.branchB, '2026-11-25T20:01:00Z', randomUUID()),
    ]);
    assert.equal(race.filter((item) => item.status === 'fulfilled').length, 1);
    const lost = race.find((item) => item.status === 'rejected');
    assert.match(lost.reason.message, /INSUFFICIENT_STOCK/);
    assert.equal(await stockOf(raceLot), race[0].status === 'fulfilled' ? '30.000' : '50.000');
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM movimientos
      WHERE lote_id=$1 AND tipo='DISTRIBUCION_SALIDA'`, [raceLot])).rows[0].n, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM existencias WHERE cantidad < 0')).rows[0].n, 0);

    // TP-15: misma clave y cuerpo en carrera; respuesta idéntica, una sola operación.
    const idemKey = randomUUID();
    const idemBody = { originLocationId: ids.plant, destinationLocationId: ids.branchA,
      distributedAt: '2026-11-25T20:02:00Z', items: [{ lotId: idemLot, quantity: '10.000' }],
      actorId: ids.operator, idempotencyKey: idemKey };
    const [first, second] = await Promise.all([
      registrarDistribucion(idemBody, deps), registrarDistribucion(idemBody, deps),
    ]);
    assert.deepEqual(first, second);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM distribuciones
      WHERE id=$1`, [first.id])).rows[0].n, 1);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM movimientos
      WHERE distribucion_id=$1`, [first.id])).rows[0].n, 2);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM solicitudes_idempotentes
      WHERE clave=$1`, [idemKey])).rows[0].n, 1);

    // TP-23: bloqueo y consumo simultáneos sobre el mismo lote.
    await pool.query(`INSERT INTO incidencias
      (id,codigo,lote_origen_id,titulo,tipo,severidad,reportado_por,fecha_deteccion)
      VALUES($1,'INC-RACE',$2,'Investigación ficticia','CALIDAD','MEDIA',$3,'2026-11-25T20:03:00Z')`,
    [ids.incident, blockLot, ids.analyst]);
    blocks = new BlockWriteService({ pool });
    let releaseHold;
    const held = new Promise((resolve) => { releaseHold = resolve; });
    const holding = deps.transaction.run(async (tx) => {
      await deps.inventory.lockLots([blockLot], tx);
      await held;
    });
    await delay(100);
    const blockPromise = blocks.block(ids.incident, [blockLot],
      'Riesgo ficticio verificado', ids.analyst, randomUUID());
    const consumePromise = distribute(blockLot, '5.000', ids.branchA,
      '2026-11-25T20:04:00Z', randomUUID());
    await delay(100);
    releaseHold();
    await holding;
    const [blocked, consumed] = await Promise.allSettled([blockPromise, consumePromise]);
    assert.equal(blocked.status, 'fulfilled', JSON.stringify(blocked));
    assert.equal(blocked.value.length, 1);
    let expectedStock;
    if (consumed.status === 'rejected') {
      assert.match(consumed.reason.message, /LOT_BLOCKED/);
      expectedStock = '100.000';
    } else {
      expectedStock = '95.000';
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM bloqueos_lotes
        WHERE lote_id=$1 AND activo`, [blockLot])).rows[0].n, 1);
    }
    // Una vez confirmado el bloqueo, ninguna distribución posterior puede consumirlo.
    await assert.rejects(distribute(blockLot, '1.000', ids.branchB,
      '2026-11-25T20:05:00Z', randomUUID()), /LOT_BLOCKED/);
    assert.equal(await stockOf(blockLot), expectedStock);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM existencias WHERE cantidad < 0')).rows[0].n, 0);

    // RN-91/92/94: dos incidencias bloquean el mismo lote; retiro individual no libera.
    const secondIncident = randomUUID();
    await pool.query(`INSERT INTO incidencias
      (id,codigo,lote_origen_id,titulo,tipo,severidad,reportado_por,fecha_deteccion)
      VALUES($1,'INC-RACE2',$2,'Segunda investigación ficticia','CALIDAD','BAJA',$3,'2026-11-25T20:06:00Z')`,
    [secondIncident, blockLot, ids.analyst]);
    const activeBlocks = (async () => (await pool.query(`SELECT count(*)::int AS n
      FROM bloqueos_lotes WHERE lote_id=$1 AND activo`, [blockLot])).rows[0].n);
    const secondBlock = await blocks.block(secondIncident, [blockLot],
      'Segunda justificación ficticia', ids.analyst, randomUUID());
    assert.equal(secondBlock.length, 1);
    assert.equal(await activeBlocks(), 2);
    const firstBlockId = blocked.value[0].id;
    await blocks.release(firstBlockId, 'Primer retiro ficticio', ids.analyst, randomUUID());
    assert.equal(await activeBlocks(), 1);
    const inventory = (await pool.query(`SELECT bloqueado, cantidad_fisica::text AS fisico,
      cantidad_utilizable::text AS utilizable FROM v_inventario WHERE lote_id=$1`, [blockLot])).rows[0];
    assert.equal(inventory.bloqueado, true);
    assert.equal(Number(inventory.utilizable), 0);
    await blocks.release(secondBlock[0].id, 'Segundo retiro ficticio', ids.analyst, randomUUID());
    assert.equal(await activeBlocks(), 0);
    const releasedInventory = (await pool.query(`SELECT bloqueado,
      cantidad_utilizable::text AS utilizable FROM v_inventario WHERE lote_id=$1`, [blockLot])).rows[0];
    assert.equal(releasedInventory.bloqueado, false);
    assert.equal(Number(releasedInventory.utilizable), Number(expectedStock));
    process.stdout.write(`CONCURRENCY_SQL_ACTUAL=${JSON.stringify({
      stockRace: 'una operación confirmada', idempotentReplay: true,
      blockRace: consumed.status === 'rejected' ? 'bloqueo primero' : 'consumo primero',
      rejectedCode: lost.reason.message.split(':')[0], blocksPerLot: 2,
      individualReleaseKeepsBlock: true,
    })}\n`);
  } finally {
    if (blocks) await blocks.onModuleDestroy();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
