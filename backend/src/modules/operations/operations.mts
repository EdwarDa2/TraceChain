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
    reserve(solicitud: SolicitudIdempotente, tx: Tx): Promise<{ replay: false } | { replay: true; status: number; body: unknown }>;
    confirm(solicitud: SolicitudIdempotente, status: number, body: unknown, tx: Tx): Promise<void>;
  };
  catalogo: {
    producto(id: string, tx: Tx): Promise<{ id: string; name: string; active: boolean; type: string; unit: string } | null>;
    proveedor(id: string, tx: Tx): Promise<{ id: string; active: boolean } | null>;
    ubicacion(id: string, tx: Tx): Promise<{ id: string; active: boolean } | null>;
    insertarProveedor(datos: { code: string; name: string }, tx: Tx): Promise<void>;
    insertarProducto(datos: { code: string; name: string }, tx: Tx): Promise<void>;
    insertarUbicacion(datos: { code: string; name: string }, tx: Tx): Promise<void>;
  };
  records: {
    insertLot(input: { id: string; code: string; productId: string; supplierId: string | null;
      supplierLotCode?: string | null; quantity: string; at: string;
      expirationDate: string | null; actorId: string }, tx: Tx): Promise<void>;
    insertProduction(input: { id: string; name: string; locationId: string; at: string;
      notes?: string | null; actorId: string }, tx: Tx): Promise<{ code: string; createdAt: string }>;
    insertConsumption(id: string, orderId: string, lotId: string, quantity: string, tx: Tx): Promise<void>;
    insertResult(id: string, orderId: string, lotId: string, quantity: string, tx: Tx): Promise<void>;
    insertDistribution(input: { id: string; originId: string; destinationId: string; at: string;
      notes?: string | null; actorId: string }, tx: Tx): Promise<{ code: string; createdAt: string }>;
    insertDetail(id: string, distributionId: string, lotId: string, quantity: string, tx: Tx): Promise<void>;
    inputLots(ids: string[], tx: Tx): Promise<Map<string, { code: string; unit: string; originAt: string;
      expirationDate: string | null; blocked: boolean; lastMovementAt: string | null }>>;
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

async function validarCatalogo(entrada: { productId: string; supplierId?: string; locationId: string },
  deps: OperationsDeps, tx: Tx) {
  const producto = await deps.catalogo.producto(entrada.productId, tx);
  if (producto === null || !producto.active) throw new Error('INACTIVE_RESOURCE: producto no elegible');
  if (entrada.supplierId !== undefined) {
    const proveedor = await deps.catalogo.proveedor(entrada.supplierId, tx);
    if (proveedor === null || !proveedor.active) throw new Error('INACTIVE_RESOURCE: proveedor no activo');
  }
  const ubicacion = await deps.catalogo.ubicacion(entrada.locationId, tx);
  if (ubicacion === null || !ubicacion.active) throw new Error('INACTIVE_RESOURCE: ubicación no activa');
  return producto;
}

function validarFecha(instant: string, now: string): number {
  if (typeof instant !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(instant)) {
    throw new Error('INVALID_OPERATION_DATE');
  }
  const value = Date.parse(instant);
  if (!Number.isFinite(value) || value > Date.parse(now)) throw new Error('INVALID_OPERATION_DATE');
  return value;
}

function validarUnidad(quantity: string, unit: string) {
  if (unit === 'UNIDAD' && !quantity.endsWith('.000')) throw new Error('INVALID_QUANTITY');
}

function businessDate(at: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
}

function validarCaducidad(expirationDate: string | null, at: number, now: number) {
  if (expirationDate !== null && (expirationDate < businessDate(at) ||
      expirationDate < businessDate(now))) throw new Error('INVALID_OPERATION_DATE');
}

async function validarInsumos(ids: string[], at: number, deps: OperationsDeps, tx: Tx) {
  const inputs = await deps.records.inputLots(ids, tx);
  if (inputs.size !== ids.length) throw new Error('RESOURCE_NOT_FOUND');
  for (const id of ids) {
    const lot = inputs.get(id)!;
    if (lot.blocked) throw new Error('LOT_BLOCKED');
    if (lot.expirationDate !== null && (lot.expirationDate < businessDate(at) ||
        lot.expirationDate < businessDate(Date.parse(deps.reloj())))) {
      throw new Error('LOT_EXPIRED');
    }
    if (at < Date.parse(lot.originAt) ||
        lot.lastMovementAt !== null && at < Date.parse(lot.lastMovementAt)) {
      throw new Error('INVALID_OPERATION_DATE');
    }
  }
  return inputs;
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
  supplierLotCode?: string | null;
  locationId: string;
  quantity: string;
  receivedAt: string;
  expirationDate: string | null;
  actorId: string;
  idempotencyKey: string;
}

export interface OperacionResultado {
  graphSyncStatus: 'PENDIENTE';
  id: string;
}

export async function registrarRecepcion(
  entrada: RecepcionEntrada,
  deps: OperationsDeps,
): Promise<OperacionResultado> {
  const code = validarCodigo(entrada.code);
  const quantity = validarCantidad(entrada.quantity);
  const request = solicitud(entrada.actorId, 'POST /lots/receipts', entrada.idempotencyKey, entrada);
  const resultado = await deps.transaction.run(async (tx) => {
    const reserva = await deps.idempotencia.reserve(request, tx);
    if (reserva.replay) return reserva.body as OperacionResultado;
    const at = validarFecha(entrada.receivedAt, deps.reloj());
    const producto = await validarCatalogo(entrada, deps, tx);
    if (producto.type !== 'MATERIA_PRIMA') throw new Error('INVALID_OPERATION');
    validarUnidad(quantity, producto.unit);
    validarCaducidad(entrada.expirationDate, at, Date.parse(deps.reloj()));
    const loteId = deps.nuevoId();
    await deps.records.insertLot({ id: loteId, code, productId: entrada.productId,
      supplierId: entrada.supplierId, supplierLotCode: entrada.supplierLotCode, quantity, at: entrada.receivedAt,
      expirationDate: entrada.expirationDate, actorId: entrada.actorId }, tx);
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
    const response = { id: loteId, code, initialQuantity: quantity,
      unit: producto.unit, originType: 'RECEPCION' as const,
      graphSyncStatus: 'PENDIENTE' as const };
    await deps.idempotencia.confirm(request, 201, response, tx);
    return response;
  });
  return resultado;
}

export interface ProduccionEntrada {
  name: string;
  notes?: string | null;
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

  const request = solicitud(entrada.actorId, 'POST /production-orders', entrada.idempotencyKey, entrada);
  return deps.transaction.run(async (tx) => {
    const reserva = await deps.idempotencia.reserve(request, tx);
    if (reserva.replay) return reserva.body as OperacionResultado;
    const at = validarFecha(entrada.producedAt, deps.reloj());
    if (typeof entrada.name !== 'string' || entrada.name.trim().length === 0 ||
        entrada.name.length > 150) throw new Error('VALIDATION_ERROR');
    const outputProducts = new Map<string, string>();
    for (const item of [...entrada.outputs].sort((a, b) => a.productId.localeCompare(b.productId))) {
      const product = await deps.catalogo.producto(item.productId, tx);
      if (!product?.active) throw new Error('INACTIVE_RESOURCE');
      if (product.type === 'MATERIA_PRIMA') throw new Error('INVALID_OPERATION');
      validarUnidad(item.quantity, product.unit);
      validarCaducidad(item.expirationDate, at, Date.parse(deps.reloj()));
      outputProducts.set(item.productId, product.unit);
    }
    const location = await deps.catalogo.ubicacion(entrada.locationId, tx);
    if (!location?.active) throw new Error('INACTIVE_RESOURCE');
    await deps.inventory.lockLots([...entrada.inputs.map((item) => item.lotId)].sort(), tx);
    const inputs = await validarInsumos(entrada.inputs.map((item) => item.lotId), at, deps, tx);
    for (const item of entrada.inputs) validarUnidad(item.quantity, inputs.get(item.lotId)!.unit);
    const ordenId = deps.nuevoId();
    const { code, createdAt } = await deps.records.insertProduction({
      id: ordenId, name: entrada.name, locationId: entrada.locationId,
      at: entrada.producedAt, notes: entrada.notes, actorId: entrada.actorId,
    }, tx);
    const inputRelations: { id: string; lotId: string; quantity: string; unit: string }[] = [];
    const responseInputs: { id: string; lotId: string; lotCode: string; quantity: string; unit: string }[] = [];
    for (const item of entrada.inputs) {
      const relationId = deps.nuevoId();
      await deps.records.insertConsumption(relationId, ordenId, item.lotId, item.quantity, tx);
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
      inputRelations.push({ id: relationId, lotId: item.lotId, quantity: item.quantity,
        unit: inputs.get(item.lotId)!.unit });
      responseInputs.push({ id: relationId, lotId: item.lotId, lotCode: inputs.get(item.lotId)!.code,
        quantity: item.quantity, unit: inputs.get(item.lotId)!.unit });
    }
    const salidas: Record<string, unknown>[] = [];
    const responseOutputs: { id: string; lotId: string; lotCode: string; productId: string;
      expirationDate: string | null; quantity: string; unit: string }[] = [];
    for (const salida of entrada.outputs) {
      const loteId = deps.nuevoId();
      const relationId = deps.nuevoId();
      await deps.records.insertLot({ id: loteId, code: validarCodigo(salida.code),
        productId: salida.productId, supplierId: null, quantity: salida.quantity,
        at: entrada.producedAt, expirationDate: salida.expirationDate,
        actorId: entrada.actorId }, tx);
      await deps.records.insertResult(relationId, ordenId, loteId, salida.quantity, tx);
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
        id: relationId,
        lot: { id: loteId, code: validarCodigo(salida.code), productId: salida.productId, originType: 'PRODUCCION', originAt: entrada.producedAt },
        quantity: salida.quantity,
        unit: outputProducts.get(salida.productId)!,
      });
      responseOutputs.push({ id: relationId, lotId: loteId, lotCode: validarCodigo(salida.code),
        productId: salida.productId, expirationDate: salida.expirationDate,
        quantity: salida.quantity, unit: outputProducts.get(salida.productId)! });
    }
    await deps.outbox.enqueue({
      eventId: deps.nuevoId(),
      eventType: 'PRODUCCION_REGISTRADA',
      entityType: 'PRODUCTION',
      entityId: ordenId,
      destination: 'NEO4J',
      payload: {
        process: { id: ordenId, code, name: entrada.name, locationId: entrada.locationId, producedAt: entrada.producedAt },
        inputs: inputRelations,
        outputs: salidas,
      },
    }, tx);
    const response = { id: ordenId, code, name: entrada.name,
      locationId: entrada.locationId, producedAt: entrada.producedAt,
      inputCount: responseInputs.length, outputCount: responseOutputs.length,
      notes: entrada.notes ?? null, actorId: entrada.actorId, createdAt,
      inputs: responseInputs, outputs: responseOutputs, graphSyncStatus: 'PENDIENTE' as const };
    await deps.idempotencia.confirm(request, 201, response, tx);
    return response;
  });
}

export interface DistribucionEntrada {
  originLocationId: string;
  destinationLocationId: string;
  distributedAt: string;
  notes?: string | null;
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

  const request = solicitud(entrada.actorId, 'POST /distributions', entrada.idempotencyKey, entrada);
  return deps.transaction.run(async (tx) => {
    const reserva = await deps.idempotencia.reserve(request, tx);
    if (reserva.replay) return reserva.body as OperacionResultado;
    const at = validarFecha(entrada.distributedAt, deps.reloj());
    for (const locationId of [entrada.originLocationId, entrada.destinationLocationId].sort()) {
      if (!(await deps.catalogo.ubicacion(locationId, tx))?.active) throw new Error('INACTIVE_RESOURCE');
    }
    await deps.inventory.lockLots(entrada.items.map((item) => item.lotId).sort(), tx);
    const inputs = await validarInsumos(entrada.items.map((item) => item.lotId), at, deps, tx);
    const distribucionId = deps.nuevoId();
    const { code, createdAt } = await deps.records.insertDistribution({ id: distribucionId,
      originId: entrada.originLocationId, destinationId: entrada.destinationLocationId,
      at: entrada.distributedAt, notes: entrada.notes, actorId: entrada.actorId }, tx);
    const details: { id: string; lotId: string; quantity: string; unit: string }[] = [];
    const responseItems: { id: string; lotId: string; lotCode: string; quantity: string; unit: string }[] = [];
    for (const item of entrada.items) {
      const unit = inputs.get(item.lotId)!.unit;
      validarUnidad(item.quantity, unit);
      const detailId = deps.nuevoId();
      await deps.records.insertDetail(detailId, distribucionId, item.lotId, item.quantity, tx);
      details.push({ id: detailId, lotId: item.lotId, quantity: item.quantity, unit });
      responseItems.push({ id: detailId, lotId: item.lotId, lotCode: inputs.get(item.lotId)!.code,
        quantity: item.quantity, unit });
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
        distribution: { id: distribucionId, code, distributedAt: entrada.distributedAt, originLocationId: entrada.originLocationId, destinationLocationId: entrada.destinationLocationId },
        items: details,
      },
    }, tx);
    const response = { id: distribucionId, code, originLocationId: entrada.originLocationId,
      destinationLocationId: entrada.destinationLocationId, distributedAt: entrada.distributedAt,
      itemCount: responseItems.length, notes: entrada.notes ?? null,
      actorId: entrada.actorId, createdAt, items: responseItems,
      graphSyncStatus: 'PENDIENTE' as const };
    await deps.idempotencia.confirm(request, 201, response, tx);
    return response;
  });
}
