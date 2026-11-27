import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTransactionManager,
  createInventoryWriter,
  createOutboxWriter,
  createIdempotencyStore,
  type PgClientLike,
  type PgPoolLike,
} from '../../backend/src/database/postgres/transaction.mts';

interface Llamada {
  sql: string;
  parametros: unknown[] | undefined;
}

class ClienteFalso implements PgClientLike {
  llamadas: Llamada[] = [];
  confirmado = false;
  revertido = false;
  liberado = false;
  filas: Record<string, unknown>[] = [];

  async query(sql: string, parametros?: unknown[]) {
    this.llamadas.push({ sql, parametros });
    if (/^SELECT/i.test(sql.trim()) && this.filas.length > 0) {
      return { rows: this.filas, rowCount: this.filas.length };
    }
    return { rows: [], rowCount: 0 };
  }
  async release() {
    this.liberado = true;
  }
}

function poolFalso(cliente: ClienteFalso): PgPoolLike {
  return { connect: async () => cliente };
}

test('TransactionManager hace COMMIT y libera el cliente cuando la operación termina', async () => {
  const cliente = new ClienteFalso();
  const manager = createTransactionManager(poolFalso(cliente));
  const resultado = await manager.run(async (tx) => {
    await tx.query('SELECT 1');
    return 42;
  });
  assert.equal(resultado, 42);
  assert.equal(cliente.llamadas[0]?.sql.trim().toUpperCase(), 'BEGIN');
  assert.equal(cliente.llamadas.at(-1)?.sql.trim().toUpperCase(), 'COMMIT');
  assert.equal(cliente.revertido, false);
  assert.equal(cliente.liberado, true);
});

test('TransactionManager hace ROLLBACK ante error y propaga la excepción', async () => {
  const cliente = new ClienteFalso();
  const manager = createTransactionManager(poolFalso(cliente));
  await assert.rejects(
    () => manager.run(async () => { throw new Error('fallo de dominio'); }),
    /fallo de dominio/,
  );
  assert.equal(cliente.llamadas.at(-1)?.sql.trim().toUpperCase(), 'ROLLBACK');
  assert.equal(cliente.confirmado, false);
  assert.equal(cliente.liberado, true);
});

test('lockLots ordena UUID y usa FOR UPDATE con parámetros', async () => {
  const cliente = new ClienteFalso();
  const manager = createTransactionManager(poolFalso(cliente));
  const writer = createInventoryWriter();
  await manager.run(async (tx) => {
    await writer.lockLots(['00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001'], tx);
  });
  const consulta = cliente.llamadas.find((llamada) => llamada.sql.includes('FOR UPDATE'))!;
  assert.equal(consulta.sql.includes('ORDER BY id'), true);
  assert.deepEqual(consulta.parametros?.[0], [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
  ]);
});

test('changeStock usa decimal exacto y escribe movimiento con saldos correctos', async () => {
  const cliente = new ClienteFalso();
  cliente.filas = [{ cantidad: '100.000' }];
  const manager = createTransactionManager(poolFalso(cliente));
  const writer = createInventoryWriter();
  const resultado = await manager.run(async (tx) => writer.changeStock({
    lotId: 'lote-1',
    locationId: 'ubicacion-1',
    delta: '-30.000',
    movementType: 'DISTRIBUCION_SALIDA',
    productionOrderId: null,
    distributionId: 'dist-1',
    actorId: 'actor-1',
    movementAt: '2026-11-25T20:00:00.000Z',
  }, tx));

  assert.equal(resultado.cantidad, '70.000');
  const actualizacion = cliente.llamadas.find((llamada) => llamada.sql.startsWith('UPDATE existencias'))!;
  assert.deepEqual(actualizacion.parametros, ['70.000', 'ubicacion-1', 'lote-1']);
  const movimiento = cliente.llamadas.find((llamada) => llamada.sql.startsWith('INSERT INTO movimientos'))!;
  assert.deepEqual(movimiento.parametros?.slice(0, 4), ['lote-1', 'ubicacion-1', 'DISTRIBUCION_SALIDA', 'SALIDA']);
  assert.equal(movimiento.parametros?.[4], '30.000');
  assert.equal(movimiento.parametros?.[5], '100.000');
  assert.equal(movimiento.parametros?.[6], '70.000');
});

test('changeStock rechaza stock negativo y cantidad con formato inválido', async () => {
  const cliente = new ClienteFalso();
  cliente.filas = [{ cantidad: '10.000' }];
  const manager = createTransactionManager(poolFalso(cliente));
  const writer = createInventoryWriter();
  const entrada = {
    lotId: 'lote-1', locationId: 'ubicacion-1', delta: '-10.001',
    movementType: 'CONSUMO_PRODUCCION' as const, productionOrderId: null,
    distributionId: null, actorId: 'actor-1', movementAt: '2026-11-25T20:00:00.000Z',
  };

  await assert.rejects(
    () => manager.run(async (tx) => writer.changeStock(entrada, tx)),
    (error: unknown) => error instanceof Error && error.message.includes('INSUFFICIENT_STOCK'),
  );
  assert.equal(cliente.llamadas.some((llamada) => llamada.sql.startsWith('UPDATE existencias')), false);
  assert.equal(cliente.llamadas.some((llamada) => llamada.sql.startsWith('INSERT INTO movimientos')), false);

  await assert.rejects(
    () => manager.run(async (tx) => writer.changeStock({ ...entrada, delta: '10.1' }, tx)),
    /INVALID_QUANTITY/,
  );
});

test('outbox guarda payloadVersion 1 y usa la transacción compartida', async () => {
  const cliente = new ClienteFalso();
  const manager = createTransactionManager(poolFalso(cliente));
  const outbox = createOutboxWriter();
  await manager.run(async (tx) => outbox.enqueue({
    eventId: 'evento-1',
    eventType: 'PRODUCCION_REGISTRADA',
    entityType: 'PRODUCTION',
    entityId: 'orden-1',
    destination: 'NEO4J',
    payload: { process: { id: 'orden-1' } },
  }, tx));

  const insercion = cliente.llamadas.find((llamada) => llamada.sql.startsWith('INSERT INTO eventos_sincronizacion'))!;
  assert.ok(insercion, 'debe insertar en outbox');
  const payload = JSON.parse(String(insercion.parametros?.[3]));
  assert.equal(payload.payloadVersion, 1);
  assert.deepEqual(payload.payload, { process: { id: 'orden-1' } });
  assert.equal(insercion.parametros?.[2], 'NEO4J');
});

test('idempotencia: replay con misma clave/hash y conflicto con hash distinto', async () => {
  const cliente = new ClienteFalso();
  const store = createIdempotencyStore();
  const clave = '00000000-0000-4000-8000-000000000077';
  const solicitud = { actorId: 'actor-1', operacion: 'POST /lots/receipts', clave, hash: 'a'.repeat(64) };

  const primera = await store.reserve(solicitud, cliente);
  assert.equal(primera.replay, false);
  await store.confirm(solicitud, 201, { data: { id: 'lote-1' } }, cliente);
  assert.ok(cliente.llamadas.some((call) => call.sql.includes('INSERT INTO solicitudes_idempotentes')));
  cliente.filas = [{ request_hash: solicitud.hash, response_status: 201, response_body: { data: { id: 'lote-1' } } }];

  const replay = await store.reserve(solicitud, cliente);
  assert.deepEqual(replay, { replay: true, status: 201, body: { data: { id: 'lote-1' } } });

  await assert.rejects(
    store.reserve({ ...solicitud, hash: 'b'.repeat(64) }, cliente),
    (error: unknown) => error instanceof Error && error.message.includes('IDEMPOTENCY_CONFLICT'),
  );
  assert.equal(cliente.llamadas.some((llamada) => llamada.sql.includes('FOR UPDATE')), true);
});
