import neo4j, { type Driver, type ManagedTransaction } from 'neo4j-driver';
import type { Delivery } from '../../outbox/dispatcher.mts';
import { PermanentDeliveryError } from '../../outbox/dispatcher.mts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const QUANTITY = /^(0|[1-9][0-9]{0,14})\.[0-9]{3}$/;
const UNITS = ['KG', 'G', 'L', 'ML', 'UNIDAD'];
const ORIGINS = ['RECEPCION', 'PRODUCCION'];
const PRODUCT_TYPES = ['MATERIA_PRIMA', 'INTERMEDIO', 'TERMINADO'];
const LOCATION_TYPES = ['ALMACEN', 'PLANTA_PRODUCCION', 'SUCURSAL'];

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new PermanentDeliveryError();
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new PermanentDeliveryError();
  return value;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw new PermanentDeliveryError();
  return value;
}
function choice(value: unknown, allowed: readonly string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new PermanentDeliveryError();
  return value;
}
function instant(value: unknown): string {
  const textValue = text(value);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(textValue) ||
      !Number.isFinite(Date.parse(textValue))) throw new PermanentDeliveryError();
  return new Date(textValue).toISOString();
}
function quantity(value: unknown, unit: unknown) {
  const numberText = text(value);
  const validUnit = choice(unit, UNITS);
  if (!QUANTITY.test(numberText) || BigInt(numberText.replace('.', '')) === 0n ||
      (validUnit === 'UNIDAD' && !numberText.endsWith('.000'))) throw new PermanentDeliveryError();
  return { quantity: neo4j.int(BigInt(numberText.replace('.', '')).toString()), unit: validUnit };
}
function list(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0) throw new PermanentDeliveryError();
  return value.map(object);
}
async function exactlyOne(tx: ManagedTransaction, query: string, params: Record<string, unknown>) {
  const result = await tx.run(query, params);
  if (result.records.length !== 1 || result.records[0]?.get('n').toNumber() !== 1) {
    throw new PermanentDeliveryError();
  }
}

async function catalog(tx: ManagedTransaction, event: Delivery) {
  const payload = event.payload;
  const kind = event.eventType === 'CATALOGO_ACTUALIZADO'
    ? choice(payload.entityType, ['SUPPLIER', 'PRODUCT', 'LOCATION'])
    : event.entityType;
  if (kind !== event.entityType) throw new PermanentDeliveryError();
  const key = kind === 'SUPPLIER' ? 'supplier' : kind === 'PRODUCT' ? 'product' : 'location';
  const entity = object(payload[key]);
  const props: Record<string, unknown> = {
    id: id(entity.id), codigo: text(entity.code), nombre: text(entity.name),
  };
  if (props.id !== event.entityId || typeof entity.active !== 'boolean') throw new PermanentDeliveryError();
  props.activo = entity.active;
  if (kind === 'PRODUCT') {
    props.tipo = choice(entity.type, PRODUCT_TYPES);
    props.unidad_medida = choice(entity.unit, UNITS);
  } else if (kind === 'LOCATION') {
    props.tipo = choice(entity.type, LOCATION_TYPES);
  }
  // La etiqueta se elige exclusivamente del conjunto cerrado, no de entrada libre.
  const label = kind === 'SUPPLIER' ? 'Proveedor' : kind === 'PRODUCT' ? 'Producto' : 'Ubicacion';
  await exactlyOne(tx, `MERGE (e:${label} {id:$id}) SET e += $props RETURN count(e) AS n`,
    { id: props.id, props });
}

async function receipt(tx: ManagedTransaction, event: Delivery) {
  const lot = object(event.payload.lot);
  const lotId = id(lot.id);
  const supplierId = id(event.payload.supplierId);
  if (lotId !== event.entityId || choice(lot.originType, ORIGINS) !== 'RECEPCION') throw new PermanentDeliveryError();
  const props = { id: lotId, codigo: text(lot.code), tipo_origen: 'RECEPCION',
    fecha_origen: neo4j.types.DateTime.fromStandardDate(new Date(instant(lot.originAt))) };
  await exactlyOne(tx, `MATCH (s:Proveedor {id:$supplierId}), (p:Producto {id:$productId})
    MERGE (l:Lote {id:$lotId}) SET l += $props
    MERGE (s)-[r:SUMINISTRA {id:$supplyId}]->(l)
      SET r.fecha_recepcion=$origin
    MERGE (l)-[:CORRESPONDE_A {id:$correspondId}]->(p)
    RETURN count(l) AS n`, {
    supplierId, productId: id(lot.productId), lotId, props, origin: props.fecha_origen,
    supplyId: `SUMINISTRA:${lotId}`, correspondId: `CORRESPONDE_A:${lotId}`,
  });
}

async function production(tx: ManagedTransaction, event: Delivery) {
  const process = object(event.payload.process);
  const processId = id(process.id);
  if (processId !== event.entityId) throw new PermanentDeliveryError();
  const inputs = list(event.payload.inputs);
  const outputs = list(event.payload.outputs);
  if (inputs.length > 50 || outputs.length > 20 ||
      new Set(inputs.map((item) => id(item.lotId))).size !== inputs.length ||
      new Set(outputs.map((item) => id(object(item.lot).id))).size !== outputs.length) {
    throw new PermanentDeliveryError();
  }
  const props = { id: processId, codigo: text(process.code), nombre: text(process.name),
    ubicacion_id: id(process.locationId),
    fecha_produccion: neo4j.types.DateTime.fromStandardDate(new Date(instant(process.producedAt))) };
  // No se crea un proceso huérfano: todos los extremos se comprueban antes de escribir.
  const missing = await tx.run(`UNWIND $ids AS lotId OPTIONAL MATCH (l:Lote {id:lotId})
    RETURN count(l) AS found`, { ids: inputs.map((item) => id(item.lotId)) });
  if (missing.records[0]?.get('found').toNumber() !== inputs.length) throw new PermanentDeliveryError();
  const products = await tx.run(`UNWIND $ids AS productId OPTIONAL MATCH (p:Producto {id:productId})
    RETURN count(p) AS found`, { ids: outputs.map((item) => id(object(item.lot).productId)) });
  if (products.records[0]?.get('found').toNumber() !== outputs.length) throw new PermanentDeliveryError();
  await exactlyOne(tx, `MERGE (p:Proceso {id:$id}) SET p += $props RETURN count(p) AS n`,
    { id: processId, props });
  for (const item of inputs) {
    const amount = quantity(item.quantity, item.unit);
    await exactlyOne(tx, `MATCH (l:Lote {id:$lotId}), (p:Proceso {id:$processId})
      MERGE (l)-[r:UTILIZADO_EN {id:$relationId}]->(p)
      SET r.cantidad_milesimas=$quantity, r.unidad=$unit RETURN count(r) AS n`, {
      lotId: id(item.lotId), processId, relationId: id(item.id), ...amount,
    });
  }
  for (const item of outputs) {
    const lot = object(item.lot);
    const lotId = id(lot.id);
    if (choice(lot.originType, ORIGINS) !== 'PRODUCCION') throw new PermanentDeliveryError();
    const amount = quantity(item.quantity, item.unit);
    await exactlyOne(tx, `MATCH (p:Proceso {id:$processId}), (product:Producto {id:$productId})
      MERGE (l:Lote {id:$lotId}) SET l += $props
      MERGE (p)-[r:GENERA {id:$relationId}]->(l)
        SET r.cantidad_milesimas=$quantity, r.unidad=$unit
      MERGE (l)-[:CORRESPONDE_A {id:$correspondId}]->(product)
      RETURN count(l) AS n`, {
      processId, productId: id(lot.productId), lotId, relationId: id(item.id),
      correspondId: `CORRESPONDE_A:${lotId}`, props: {
        id: lotId, codigo: text(lot.code), tipo_origen: 'PRODUCCION',
        fecha_origen: neo4j.types.DateTime.fromStandardDate(new Date(instant(lot.originAt))),
      }, ...amount,
    });
  }
}

/** Transacción por evento; cualquier extremo ausente o payload inválido revierte TODO el evento. */
export async function applyGraphEvent(driver: Driver, database: string, event: Delivery, signal: AbortSignal) {
  if (event.destination !== 'NEO4J' || event.payloadVersion !== 1 ||
      !UUID.test(event.eventId) || !UUID.test(event.entityId)) throw new PermanentDeliveryError();
  signal.throwIfAborted();
  const session = driver.session({ database });
  const abort = () => { void session.close(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    await session.executeWrite(async (tx) => {
      if (['PROVEEDOR_CREADO', 'PRODUCTO_CREADO', 'UBICACION_CREADA', 'CATALOGO_ACTUALIZADO'].includes(event.eventType)) {
        await catalog(tx, event);
      } else if (event.eventType === 'LOTE_RECIBIDO') {
        if (event.entityType !== 'LOT') throw new PermanentDeliveryError();
        await receipt(tx, event);
      } else if (event.eventType === 'PRODUCCION_REGISTRADA') {
        if (event.entityType !== 'PRODUCTION') throw new PermanentDeliveryError();
        await production(tx, event);
      } else throw new PermanentDeliveryError();
      signal.throwIfAborted();
    });
  } finally {
    signal.removeEventListener('abort', abort);
    await session.close();
  }
}
