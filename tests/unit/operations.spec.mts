import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearProveedor,
  registrarDistribucion,
  registrarProduccion,
  registrarRecepcion,
  validarCantidad,
  validarCodigo,
  type OperationsDeps,
} from '../../backend/src/modules/operations/operations.mts';
import type { Tx } from '../../backend/src/database/postgres/transaction.mts';

const AHORA = '2026-11-25T20:00:00.000Z';
const UUID = '00000000-0000-4000-8000-000000000001';

interface Entorno {
  deps: OperationsDeps;
  cambios: Record<string, unknown>[];
  bloqueos: string[][];
  eventos: Record<string, unknown>[];
  insertados: string[];
}

function entorno(opciones: { proveedorActivo?: boolean } = {}): Entorno {
  const cambios: Record<string, unknown>[] = [];
  const bloqueos: string[][] = [];
  const eventos: Record<string, unknown>[] = [];
  const insertados: string[] = [];
  let contador = 0;
  const tx: Tx = { query: async () => ({ rows: [], rowCount: 0 }) };

  const deps: OperationsDeps = {
    transaction: { run: async (work) => work(tx) },
    inventory: {
      lockLots: async (ids) => { bloqueos.push([...ids]); },
      changeStock: async (cambio) => { cambios.push({ ...cambio }); return { cantidad: '0.000' }; },
    },
    outbox: {
      enqueue: async (evento) => { eventos.push({ ...evento }); },
    },
    idempotencia: {
      reserve: async () => ({ replay: false }),
      confirm: async () => {},
    },
    catalogo: {
      producto: async (id) => ({ id, name: 'Harina', active: true, type: 'MATERIA_PRIMA', unit: 'KG' }),
      proveedor: async (id) => ({ id, active: opciones.proveedorActivo ?? true }),
      ubicacion: async (id) => ({ id, active: true }),
      insertarProveedor: async (datos) => { insertados.push(`proveedor:${datos.code}`); },
      insertarProducto: async (datos) => { insertados.push(`producto:${datos.code}`); },
      insertarUbicacion: async (datos) => { insertados.push(`ubicacion:${datos.code}`); },
    },
    reloj: () => AHORA,
    nuevoId: () => `id-${++contador}`,
  };
  return { deps, cambios, bloqueos, eventos, insertados };
}

test('validarCodigo normaliza y rechaza códigos fuera del contrato', () => {
  assert.equal(validarCodigo(' mp-001 '), 'MP-001');
  assert.equal(validarCodigo('mp-002'), 'MP-002');
  for (const codigo of ['MP 001', '', 'X'.repeat(51)]) {
    assert.throws(() => validarCodigo(codigo), (error: unknown) =>
      error instanceof Error && error.message.includes('VALIDATION_ERROR'));
  }
});

test('validarCantidad exige tres decimales exactos y positivos', () => {
  assert.equal(validarCantidad('100.000'), '100.000');
  for (const cantidad of ['10.1', '0.000', '-1.000', '1e3', Number.NaN as unknown as string]) {
    assert.throws(() => validarCantidad(cantidad), (error: unknown) =>
      error instanceof Error && error.message.includes('INVALID_QUANTITY'));
  }
});

test('crear proveedor valida código y delega en el repositorio', async () => {
  const ent = entorno();
  await crearProveedor({ code: 'prov-009', name: 'Proveedor ficticio' }, ent.deps);
  assert.deepEqual(ent.insertados, ['proveedor:PROV-009']);
});

test('recepción: stock, movimiento y evento atómicos con estado PENDIENTE', async () => {
  const ent = entorno();
  const resultado = await registrarRecepcion({
    code: 'MP-009', productId: 'prd-1', supplierId: 'prov-1', locationId: 'ub-1',
    quantity: '100.000', receivedAt: AHORA, expirationDate: null,
    actorId: 'user-1', idempotencyKey: UUID,
  }, ent.deps);

  assert.equal(resultado.graphSyncStatus, 'PENDIENTE');
  assert.equal(ent.cambios.length, 1);
  assert.equal(ent.cambios[0]?.delta, '100.000');
  assert.equal(ent.cambios[0]?.movementType, 'RECEPCION');
  assert.equal(ent.eventos[0]?.eventType, 'LOTE_RECIBIDO');
});

test('recepción con proveedor inactivo se rechaza sin escribir', async () => {
  const ent = entorno({ proveedorActivo: false });
  await assert.rejects(
    () => registrarRecepcion({
      code: 'MP-009', productId: 'prd-1', supplierId: 'prov-1', locationId: 'ub-1',
      quantity: '100.000', receivedAt: AHORA, expirationDate: null,
      actorId: 'user-1', idempotencyKey: UUID,
    }, ent.deps),
    (error: unknown) => error instanceof Error && error.message.includes('INACTIVE_RESOURCE'),
  );
  assert.equal(ent.cambios.length, 0);
  assert.equal(ent.eventos.length, 0);
});

test('producción multiinsumo/multisalida bloquea lotes y proyecta todas las dependencias', async () => {
  const ent = entorno();
  const resultado = await registrarProduccion({
    name: 'Elaboración de masa', locationId: 'ub-1', producedAt: AHORA,
    inputs: [{ lotId: 'mp-2', quantity: '30.000' }, { lotId: 'mp-1', quantity: '5.000' }],
    outputs: [
      { code: 'LP-009', productId: 'prd-4', quantity: '35.000', expirationDate: null },
      { code: 'LP-010', productId: 'prd-5', quantity: '10.000', expirationDate: null },
    ],
    actorId: 'user-1', idempotencyKey: UUID,
  }, ent.deps);

  assert.equal(ent.bloqueos[0]?.join(','), 'mp-1,mp-2');
  assert.equal(ent.cambios.length, 4);
  assert.equal(ent.eventos[0]?.eventType, 'PRODUCCION_REGISTRADA');
  const payload = ent.eventos[0]?.payload as { inputs: unknown[]; outputs: unknown[] };
  assert.equal(payload.inputs.length, 2);
  assert.equal(payload.outputs.length, 2);
  assert.equal(resultado.graphSyncStatus, 'PENDIENTE');
});

test('producción rechaza insumos duplicados y salidas vacías', async () => {
  const ent = entorno();
  const base = {
    name: 'Elaboración', locationId: 'ub-1', producedAt: AHORA,
    inputs: [{ lotId: 'mp-1', quantity: '30.000' }, { lotId: 'mp-1', quantity: '5.000' }],
    outputs: [{ code: 'LP-009', productId: 'prd-4', quantity: '35.000', expirationDate: null }],
    actorId: 'user-1', idempotencyKey: UUID,
  };
  await assert.rejects(() => registrarProduccion(base, ent.deps), /INVALID_OPERATION/);
  await assert.rejects(
    () => registrarProduccion({ ...base, inputs: [{ lotId: 'mp-1', quantity: '30.000' }], outputs: [] }, ent.deps),
    /INVALID_OPERATION/,
  );
});

test('distribución conserva el ID del lote y genera salida/entrada por ítem', async () => {
  const ent = entorno();
  await registrarDistribucion({
    originLocationId: 'ub-1', destinationLocationId: 'ub-2', distributedAt: AHORA,
    items: [{ lotId: 'lp-1', quantity: '40.000' }], actorId: 'user-1', idempotencyKey: UUID,
  }, ent.deps);

  assert.equal(ent.cambios.length, 2);
  assert.equal(ent.cambios[0]?.delta, '-40.000');
  assert.equal(ent.cambios[0]?.movementType, 'DISTRIBUCION_SALIDA');
  assert.equal(ent.cambios[1]?.delta, '40.000');
  assert.equal(ent.cambios[1]?.movementType, 'DISTRIBUCION_ENTRADA');
  assert.equal(ent.eventos[0]?.eventType, 'DISTRIBUCION_REGISTRADA');
});

test('distribución rechaza origen igual al destino', async () => {
  const ent = entorno();
  await assert.rejects(
    () => registrarDistribucion({
      originLocationId: 'ub-1', destinationLocationId: 'ub-1', distributedAt: AHORA,
      items: [{ lotId: 'lp-1', quantity: '40.000' }], actorId: 'user-1', idempotencyKey: UUID,
    }, ent.deps),
    /INVALID_OPERATION/,
  );
});
