/**
 * Casos de uso operativos de I-1 (REL-05/07/08/09).
 * Fuentes: RN-12..48/110/112/113, API_CONTRACT.md §3, DATA_MODEL.md §2.
 * Orquestación pura con puertos inyectados; reutiliza InventoryWriter, OutboxWriter
 * e idempotencia ya probados. Sin NestJS, sin driver y sin mocks en aplicación integrada.
 */

import { createHash } from 'node:crypto';
import type {
  Tx,
  CambioStock,
  EventoOutbox,
  SolicitudIdempotente,
} from '../../database/postgres/transaction.mts';

export interface OperationsDeps {
  transaction: { run<T>(work: (tx: Tx) => Promise<T>): Promise<T> };
  inventory: {
    lockLots(ids: string[], tx?: Tx): Promise<void>;
    changeStock(cambio: CambioStock, tx: Tx): Promise<{ cantidad: string }>;
  };
  outbox: { enqueue(evento: EventoOutbox, tx: Tx): Promise<void> };
  idempotencia: {
    reserve(solicitud: SolicitudIdempotente): { replay: false } | { replay: true; status: number; body: unknown };
    confirm(solicitud: SolicitudIdempotente, status: number, body: unknown): Promise<void>;
  };
  catalogo: {
    producto(id: string): Promise<{ id: string; name: string; active: boolean; type: string; unit: string } | null>;
    proveedor(id: string): Promise<{ id: string; active: boolean } | null>;
    ubicacion(id: string): Promise<{ id: string; active: boolean } | null>;
    insertarProveedor(datos: { code: string; name: string }, tx: Tx): Promise<void>;
    insertarProducto(datos: { code: string; name: string }, tx: Tx): Promise<void>;
    insertarUbicacion(datos: { code: string; name: string }, tx: Tx): Promise<void>;
  };
  reloj(): string;
  nuevoId(): string;
}

export function validarCodigo(valor: string): string {
  const codigo = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
  if (!/^[A-Z0-9_-]{1,50}$/.test(codigo)) {
    throw new Error('VALIDATION_ERROR: código fuera del formato oficial');
  }
  return codigo;
}

export function validarCantidad(valor: string): string {
  if (typeof valor !== 'string' || !/^(0|[1-9][0-9]{0,14})\.[0-9]{3}$/.test(valor)) {
    throw new Error('INVALID_QUANTITY: se requieren tres decimales exactos');
  }
  if (BigInt(valor.replace('.', '')) <= 0n) throw new Error('INVALID_QUANTITY: cantidad positiva');
  return valor;
}

function hashDe(valor: unknown): string {
  return createHash('sha256').update(JSON.stringify(valor)).digest('hex');
}

function solicitud(actorId: string, operacion: string, clave: string, cuerpo: unknown): SolicitudIdempotente {
  return { actorId, operacion, clave, hash: hashDe(cuerpo) };
}

async function validarCatalogo(entrada: { productId: string; supplierId?: string; locationId: string }, deps: OperationsDeps) {
  const producto = await deps.catalogo.producto(entrada.productId);
  if (producto === null || !producto.active) throw new Error('INACTIVE_RESOURCE: producto no elegible');
  const ubicacion = await deps.catalogo.ubicacion(entrada.locationId);
  if (ubicacion === null || !ubicacion.active) throw new Error('INACTIVE_RESOURCE: ubicación no activa');
  if (entrada.supplierId !== undefined) {
    const proveedor = await deps.catalogo.proveedor(entrada.supplierId);
    if (proveedor === null || !proveedor.active) throw new Error('INACTIVE_RESOURCE: proveedor no activo');
  }
  return producto;
}

export async function crearProveedor(
  entrada: { code: string; name: string },
  deps: OperationsDeps,
): Promise<{ code: string }> {
  const code = validarCodigo(entrada.code);
  if (typeof entrada.name !== 'string' || entrada.name.trim().length < 1 || entrada.name.length > 150) {
    throw new Error('VALIDATION_ERROR: nombre inválido');
  }
  await deps.transaction.run((tx) => deps.catalogo.insertarProveedor({ code, name: entrada.name }, tx));
  return { code };
}

export interface RecepcionEntrada {
  code: string;
  productId: string;
  supplierId: string;
  locationId: string;
  quantity: string;
  receivedAt: string;
  expirationDate: string | null;
  actorId: string;
  idempotencyKey: string;
}

export interface OperacionResultado {
  graphSyncStatus: 'PENDIENTE';
  id?: string;
}

export async function registrarRecepcion(
  entrada: RecepcionEntrada,
  deps: OperationsDeps,
): Promise<OperacionResultado> {
  const code = validarCodigo(entrada.code);
  const quantity = validarCantidad(entrada.quantity);
  const producto = await validarCatalogo(entrada, deps);

  const reserva = deps.idempotencia.reserve(
    solicitud(entrada.actorId, 'POST /lots/receipts', entrada.idempotencyKey, entrada),
  );
  if (reserva.replay) return reserva.body as OperacionResultado;

  let loteId = '';
  await deps.transaction.run(async (tx) => {
    loteId = deps.nuevoId();
    await deps.inventory.changeStock({
      lotId: loteId,
      locationId: entrada.locationId,
      delta: quantity,
      movementType: 'RECEPCION',
      productionOrderId: null,
      distributionId: null,
      actorId: entrada.actorId,
      movementAt: entrada.receivedAt,
    }, tx);
    await deps.outbox.enqueue({
      eventId: deps.nuevoId(),
      eventType: 'LOTE_RECIBIDO',
      entityType: 'LOT',
      entityId: loteId,
      destination: 'NEO4J',
      payload: {
        lot: { id: loteId, code, productId: entrada.productId, originType: 'RECEPCION', originAt: entrada.receivedAt },
        supplierId: entrada.supplierId,
      },
    }, tx);
  });

  const resultado: OperacionResultado = { graphSyncStatus: 'PENDIENTE', id: loteId };
  await deps.idempotencia.confirm(
    solicitud(entrada.actorId, 'POST /lots/receipts', entrada.idempotencyKey, entrada),
    201,
    resultado,
  );
  void producto;
  return resultado;
}

export interface ProduccionEntrada {
  name: string;
  locationId: string;
  producedAt: string;
  inputs: { lotId: string; quantity: string }[];
  outputs: { code: string; productId: string; quantity: string; expirationDate: string | null }[];
  actorId: string;
  idempotencyKey: string;
}

export async function registrarProduccion(
  entrada: ProduccionEntrada,
  deps: OperationsDeps,
): Promise<OperacionResultado> {
  if (!Array.isArray(entrada.inputs) || entrada.inputs.length < 1 || entrada.inputs.length > 50 ||
      new Set(entrada.inputs.map((item) => item.lotId)).size !== entrada.inputs.length ||
      !Array.isArray(entrada.outputs) || entrada.outputs.length < 1 || entrada.outputs.length > 20 ||
      new Set(entrada.outputs.map((item) => validarCodigo(item.code))).size !== entrada.outputs.length) {
    throw new Error('INVALID_OPERATION: entradas/salidas inválidas o duplicadas');
  }
  for (const item of [...entrada.inputs, ...entrada.outputs]) validarCantidad(item.quantity);

  const ordenId = deps.nuevoId();
  await deps.inventory.lockLots([...entrada.inputs.map((item) => item.lotId)].sort(), undefined);

  await deps.transaction.run(async (tx) => {
    for (const item of entrada.inputs) {
      await deps.inventory.changeStock({
        lotId: item.lotId,
        locationId: entrada.locationId,
        delta: `-${item.quantity}`,
        movementType: 'CONSUMO_PRODUCCION',
        productionOrderId: ordenId,
        distributionId: null,
        actorId: entrada.actorId,
        movementAt: entrada.producedAt,
      }, tx);
    }
    const salidas: Record<string, unknown>[] = [];
    for (const salida of entrada.outputs) {
      const loteId = deps.nuevoId();
      await deps.inventory.changeStock({
        lotId: loteId,
        locationId: entrada.locationId,
        delta: salida.quantity,
        movementType: 'RESULTADO_PRODUCCION',
        productionOrderId: ordenId,
        distributionId: null,
        actorId: entrada.actorId,
        movementAt: entrada.producedAt,
      }, tx);
      salidas.push({
        id: deps.nuevoId(),
        lot: { id: loteId, code: validarCodigo(salida.code), productId: salida.productId, originType: 'PRODUCCION', originAt: entrada.producedAt },
        quantity: salida.quantity,
        unit: 'KG',
      });
    }
    await deps.outbox.enqueue({
      eventId: deps.nuevoId(),
      eventType: 'PRODUCCION_REGISTRADA',
      entityType: 'PRODUCTION',
      entityId: ordenId,
      destination: 'NEO4J',
      payload: {
        process: { id: ordenId, code: `OP-${ordenId}`, name: entrada.name, locationId: entrada.locationId, producedAt: entrada.producedAt },
        inputs: entrada.inputs.map((item) => ({ id: deps.nuevoId(), lotId: item.lotId, quantity: item.quantity, unit: 'KG' })),
        outputs: salidas,
      },
    }, tx);
  });

  return { graphSyncStatus: 'PENDIENTE', id: ordenId };
}

export interface DistribucionEntrada {
  originLocationId: string;
  destinationLocationId: string;
  distributedAt: string;
  items: { lotId: string; quantity: string }[];
  actorId: string;
  idempotencyKey: string;
}

export async function registrarDistribucion(
  entrada: DistribucionEntrada,
  deps: OperationsDeps,
): Promise<OperacionResultado> {
  if (entrada.originLocationId === entrada.destinationLocationId ||
      !Array.isArray(entrada.items) || entrada.items.length < 1 || entrada.items.length > 50 ||
      new Set(entrada.items.map((item) => item.lotId)).size !== entrada.items.length) {
    throw new Error('INVALID_OPERATION: distribución inválida');
  }
  for (const item of entrada.items) validarCantidad(item.quantity);

  const distribucionId = deps.nuevoId();
  await deps.transaction.run(async (tx) => {
    for (const item of entrada.items) {
      const comun = {
        lotId: item.lotId,
        movementAt: entrada.distributedAt,
        actorId: entrada.actorId,
        productionOrderId: null,
        distributionId: distribucionId,
      };
      await deps.inventory.changeStock({
        ...comun,
        locationId: entrada.originLocationId,
        delta: `-${item.quantity}`,
        movementType: 'DISTRIBUCION_SALIDA',
      }, tx);
      await deps.inventory.changeStock({
        ...comun,
        locationId: entrada.destinationLocationId,
        delta: item.quantity,
        movementType: 'DISTRIBUCION_ENTRADA',
      }, tx);
    }
    await deps.outbox.enqueue({
      eventId: deps.nuevoId(),
      eventType: 'DISTRIBUCION_REGISTRADA',
      entityType: 'DISTRIBUTION',
      entityId: distribucionId,
      destination: 'NEO4J',
      payload: {
        distribution: { id: distribucionId, distributedAt: entrada.distributedAt, originLocationId: entrada.originLocationId, destinationLocationId: entrada.destinationLocationId },
        items: entrada.items.map((item) => ({ id: deps.nuevoId(), lotId: item.lotId, quantity: item.quantity, unit: 'KG' })),
      },
    }, tx);
  });

  return { graphSyncStatus: 'PENDIENTE', id: distribucionId };
}
