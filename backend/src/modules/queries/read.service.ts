/**
 * Endpoints de lectura de I-1/I-2/I-3 sobre los motores ya autorizados.
 * Fuentes: API_CONTRACT.md §3, QP/QM/QG catálogos y RN-123.
 * Controller delgado: filtros allowlist, SQL parametrizado y respuesta camelCase.
 */
import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import neo4j, { type Driver } from 'neo4j-driver';
import type { Document } from 'mongodb';
import { SqlService } from '../../database/postgres/sql.service';
import { MongoService } from '../../database/mongodb/mongo.service';
import { createOutboxWriter } from '../../database/postgres/transaction.mts';
import { validateEnv } from '../../config/env.validation.mts';

type Row = Record<string, unknown>;
type Query = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function iso(value: unknown): string {
  return new Date(value as string).toISOString();
}
function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}
function str(value: unknown): string {
  return String(value ?? '');
}
function nullableStr(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
function qty(value: unknown): string {
  return String(value ?? '0.000');
}
function bson(value: unknown): unknown {
  if (value && typeof value === 'object' && '_bsontype' in value) return String(value);
  return value;
}
function bool(value: unknown): boolean {
  return value === true;
}
function requireId(value: string): string {
  if (!UUID.test(value)) throw new Error('VALIDATION_ERROR');
  return value;
}
function validateCode(value: unknown): string {
  if (typeof value !== 'string') throw new Error('VALIDATION_ERROR');
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,50}$/.test(code)) throw new Error('VALIDATION_ERROR');
  return code;
}
function validateText(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new Error('VALIDATION_ERROR');
  }
  return value;
}
function allow(query: Query, keys: string[]): void {
  if (Object.keys(query).some((key) => !keys.includes(key))) throw new Error('VALIDATION_ERROR');
}
function paging(query: Query, sorts: Record<string, string>, defaultSort: string) {
  const pageRaw = query.page === undefined ? 1 : Number(query.page);
  const limitRaw = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(pageRaw) || pageRaw < 1 ||
      !Number.isSafeInteger(limitRaw) || limitRaw < 1 || limitRaw > 100) {
    throw new Error('VALIDATION_ERROR');
  }
  const sortBy = query.sortBy === undefined ? defaultSort : String(query.sortBy);
  if (!Object.hasOwn(sorts, sortBy)) throw new Error('VALIDATION_ERROR');
  const sortOrder = query.sortOrder === undefined
    ? (defaultSort === 'code' ? 'asc' : 'desc') : String(query.sortOrder);
  if (sortOrder !== 'asc' && sortOrder !== 'desc') throw new Error('VALIDATION_ERROR');
  return { limit: limitRaw, offset: (pageRaw - 1) * limitRaw, page: pageRaw,
    column: sorts[sortBy], order: sortOrder.toUpperCase() };
}
function meta(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
}
function boolParam(value: unknown): boolean | null {
  if (value === undefined) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('VALIDATION_ERROR');
}
function dateRange(query: Query): { from: string | null; to: string | null } {
  const from = query.dateFrom === undefined ? null : String(query.dateFrom);
  const to = query.dateTo === undefined ? null : String(query.dateTo);
  if (from !== null && !/^\d{4}-\d\d-\d\dT/.test(from)) throw new Error('VALIDATION_ERROR');
  if (to !== null && !/^\d{4}-\d\d-\d\dT/.test(to)) throw new Error('VALIDATION_ERROR');
  if (from !== null && to !== null && Date.parse(from) >= Date.parse(to)) {
    throw new Error('VALIDATION_ERROR');
  }
  return { from, to };
}
function search(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 150) throw new Error('VALIDATION_ERROR');
  return value.replace(/[%_]/g, '\\$&');
}

@Injectable()
export class ReadService implements OnModuleDestroy {
  private readonly config = validateEnv(process.env);
  private readonly graph: Driver = neo4j.driver(this.config.NEO4J_URI,
    neo4j.auth.basic(this.config.NEO4J_USER, this.config.NEO4J_PASSWORD));
  constructor(private readonly sql: SqlService, private readonly mongo: MongoService) {}

  async onModuleDestroy(): Promise<void> {
    await this.graph.close();
  }

  private async list(table: string, columns: string, query: Query, filters: {
    where: string[]; values: unknown[];
  }, sorts: Record<string, string>, defaultSort: string) {
    const p = paging(query, sorts, defaultSort);
    const where = filters.where.length ? ` WHERE ${filters.where.join(' AND ')}` : '';
    const total = Number((await this.sql.pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM ${table}${where}`, filters.values)).rows[0].total);
    const rows = (await this.sql.pool.query<Row>(
      `SELECT ${columns} FROM ${table}${where} ORDER BY ${p.column} ${p.order}, id ASC
       LIMIT $${filters.values.length + 1} OFFSET $${filters.values.length + 2}`,
      [...filters.values, p.limit, p.offset])).rows;
    return { rows, total: { total, page: p.page, limit: p.limit } };
  }

  async suppliers(query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'search', 'active']);
    const active = boolParam(query.active);
    const term = search(query.search);
    const where: string[] = [];
    const values: unknown[] = [];
    if (term) { values.push(`%${term}%`); where.push(`(nombre ILIKE $${values.length} OR codigo ILIKE $${values.length})`); }
    if (active !== null) { values.push(active); where.push(`activo = $${values.length}`); }
    const result = await this.list('proveedores', 'id,codigo,nombre,contacto,correo,telefono,direccion,activo,created_at,updated_at',
      query, { where, values }, { code: 'codigo', name: 'nombre', createdAt: 'created_at' }, 'code');
    return { data: result.rows.map((row) => ({ id: str(row.id), code: str(row.codigo),
      name: str(row.nombre), contactName: nullableStr(row.contacto), email: nullableStr(row.correo),
      phone: nullableStr(row.telefono), address: nullableStr(row.direccion),
      active: bool(row.activo), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) })),
    meta: meta(result.total.total, result.total.page, result.total.limit) };
  }

  async supplier(id: string) {
    const row = (await this.sql.pool.query<Row>('SELECT * FROM proveedores WHERE id=$1',
      [requireId(id)])).rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    return { data: { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
      contactName: nullableStr(row.contacto), email: nullableStr(row.correo),
      phone: nullableStr(row.telefono), address: nullableStr(row.direccion),
      active: bool(row.activo), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) } };
  }

  async products(query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'search', 'type', 'active']);
    if (query.type !== undefined && !['MATERIA_PRIMA', 'INTERMEDIO', 'TERMINADO'].includes(String(query.type))) {
      throw new Error('VALIDATION_ERROR');
    }
    const active = boolParam(query.active);
    const term = search(query.search);
    const where: string[] = [];
    const values: unknown[] = [];
    if (term) { values.push(`%${term}%`); where.push(`(nombre ILIKE $${values.length} OR codigo ILIKE $${values.length})`); }
    if (query.type !== undefined) { values.push(query.type); where.push(`tipo = $${values.length}`); }
    if (active !== null) { values.push(active); where.push(`activo = $${values.length}`); }
    const result = await this.list('productos', 'id,codigo,nombre,descripcion,tipo,unidad_medida,activo,created_at,updated_at',
      query, { where, values }, { code: 'codigo', name: 'nombre', createdAt: 'created_at' }, 'code');
    return { data: result.rows.map((row) => ({ id: str(row.id), code: str(row.codigo),
      name: str(row.nombre), description: nullableStr(row.descripcion),
      type: str(row.tipo), unit: str(row.unidad_medida), active: bool(row.activo),
      createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) })),
    meta: meta(result.total.total, result.total.page, result.total.limit) };
  }

  async product(id: string) {
    const row = (await this.sql.pool.query<Row>('SELECT * FROM productos WHERE id=$1',
      [requireId(id)])).rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    return { data: { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
      description: nullableStr(row.descripcion), type: str(row.tipo),
      unit: str(row.unidad_medida), active: bool(row.activo),
      createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) } };
  }

  async locations(query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'search', 'type', 'active']);
    if (query.type !== undefined && !['ALMACEN', 'PLANTA_PRODUCCION', 'SUCURSAL'].includes(String(query.type))) {
      throw new Error('VALIDATION_ERROR');
    }
    const active = boolParam(query.active);
    const term = search(query.search);
    const where: string[] = [];
    const values: unknown[] = [];
    if (term) { values.push(`%${term}%`); where.push(`(nombre ILIKE $${values.length} OR codigo ILIKE $${values.length})`); }
    if (query.type !== undefined) { values.push(query.type); where.push(`tipo = $${values.length}`); }
    if (active !== null) { values.push(active); where.push(`activo = $${values.length}`); }
    const result = await this.list('ubicaciones', 'id,codigo,nombre,tipo,direccion,activo,created_at,updated_at',
      query, { where, values }, { code: 'codigo', name: 'nombre', createdAt: 'created_at' }, 'code');
    return { data: result.rows.map((row) => ({ id: str(row.id), code: str(row.codigo),
      name: str(row.nombre), type: str(row.tipo), address: nullableStr(row.direccion),
      active: bool(row.activo), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) })),
    meta: meta(result.total.total, result.total.page, result.total.limit) };
  }

  async location(id: string) {
    const row = (await this.sql.pool.query<Row>('SELECT * FROM ubicaciones WHERE id=$1',
      [requireId(id)])).rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    return { data: { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
      type: str(row.tipo), address: nullableStr(row.direccion), active: bool(row.activo),
      createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) } };
  }

  private mapLot(row: Row) {
    const physical = Number(row.total_fisico ?? row.cantidad ?? 0);
    const usable = Number(row.total_utilizable ?? row.cantidad ?? 0);
    return { id: str(row.id), code: str(row.codigo), productId: str(row.producto_id),
      productName: str(row.nombre_producto), productType: str(row.tipo_producto),
      supplierId: nullableStr(row.proveedor_id), supplierLotCode: nullableStr(row.codigo_lote_proveedor),
      originType: str(row.tipo_origen), initialQuantity: qty(row.cantidad_inicial),
      originAt: iso(row.fecha_origen), expirationDate: nullableStr(row.fecha_caducidad)?.slice(0, 10) ?? null,
      unit: str(row.unidad_medida), registeredBy: str(row.registrado_por), createdAt: iso(row.created_at),
      physicalQuantity: physical.toFixed(3), usableQuantity: usable.toFixed(3),
      blocked: bool(row.bloqueado), expired: bool(row.caducado), exhausted: physical === 0,
      graphSyncStatus: bool(row.sync_pending) ? 'PENDIENTE' : 'SINCRONIZADO' };
  }

  private lotColumns() {
    return `l.*, p.nombre AS nombre_producto, p.tipo AS tipo_producto, p.unidad_medida,
      COALESCE(v.total_fisico,0) AS total_fisico, COALESCE(v.total_utilizable,0) AS total_utilizable,
      EXISTS(SELECT 1 FROM bloqueos_lotes b WHERE b.lote_id=l.id AND b.activo) AS bloqueado,
      COALESCE(v.caducado,false) AS caducado,
      EXISTS(SELECT 1 FROM eventos_sincronizacion e WHERE e.entidad_id=l.id
        AND e.motor_destino='NEO4J' AND e.estado<>'COMPLETADO') AS sync_pending`;
  }
  private lotFrom() {
    return ` FROM lotes l JOIN productos p ON p.id=l.producto_id
      LEFT JOIN v_estado_lotes v ON v.lote_id=l.id`;
  }

  async lots(query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'search', 'productId', 'supplierId', 'expired', 'blocked']);
    const term = search(query.search);
    const where: string[] = [];
    const values: unknown[] = [];
    if (term) { values.push(`%${term}%`); where.push(`l.codigo ILIKE $${values.length}`); }
    for (const [key, column] of [['productId', 'l.producto_id'], ['supplierId', 'l.proveedor_id']] as const) {
      if (query[key] !== undefined) {
        values.push(requireId(String(query[key])));
        where.push(`${column} = $${values.length}`);
      }
    }
    const expired = boolParam(query.expired);
    const blocked = boolParam(query.blocked);
    if (expired !== null) { values.push(expired); where.push(`COALESCE(v.caducado,false) = $${values.length}`); }
    if (blocked !== null) { values.push(blocked); where.push(`EXISTS(SELECT 1 FROM bloqueos_lotes b WHERE b.lote_id=l.id AND b.activo) = $${values.length}`); }
    const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const p = paging(query, { code: 'l.codigo', originAt: 'l.fecha_origen' }, 'originAt');
    const total = Number((await this.sql.pool.query<{ total: string }>(
      `SELECT count(*)::text AS total${this.lotFrom()}${clause}`, values)).rows[0].total);
    const rows = (await this.sql.pool.query<Row>(
      `SELECT ${this.lotColumns()}${this.lotFrom()}${clause}
       ORDER BY ${p.column} ${p.order}, l.id ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.limit, p.offset])).rows;
    return { data: rows.map((row) => this.mapLot(row)),
      meta: meta(total, p.page, p.limit) };
  }

  async lot(id: string) {
    const row = (await this.sql.pool.query<Row>(
      `SELECT ${this.lotColumns()}${this.lotFrom()} WHERE l.id=$1`, [requireId(id)])).rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    return { data: this.mapLot(row) };
  }

  async inventory(query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'search', 'lotId', 'productId',
      'supplierId', 'locationId', 'blocked', 'expired']);
    const term = search(query.search);
    const where: string[] = [];
    const values: unknown[] = [];
    if (term) { values.push(`%${term}%`); where.push(`l.codigo ILIKE $${values.length}`); }
    for (const [key, column] of [['lotId', 'e.lote_id'], ['productId', 'l.producto_id'],
      ['supplierId', 'l.proveedor_id'], ['locationId', 'e.ubicacion_id']] as const) {
      if (query[key] !== undefined) {
        values.push(requireId(String(query[key])));
        where.push(`${column} = $${values.length}`);
      }
    }
    const blocked = boolParam(query.blocked);
    const expired = boolParam(query.expired);
    if (blocked !== null) { values.push(blocked); where.push(`v.bloqueado = $${values.length}`); }
    if (expired !== null) { values.push(expired); where.push(`v.caducado = $${values.length}`); }
    const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const from = ` FROM existencias e JOIN lotes l ON l.id=e.lote_id
      JOIN productos p ON p.id=l.producto_id JOIN ubicaciones u ON u.id=e.ubicacion_id
      LEFT JOIN v_inventario v ON v.lote_id=e.lote_id AND v.ubicacion_id=e.ubicacion_id`;
    const p = paging(query, { updatedAt: 'e.updated_at', lotCode: 'l.codigo' }, 'updatedAt');
    const total = Number((await this.sql.pool.query<{ total: string }>(
      `SELECT count(*)::text AS total${from}${clause}`, values)).rows[0].total);
    const rows = (await this.sql.pool.query<Row>(
      `SELECT l.id AS lot_id, l.codigo AS lot_code, l.producto_id, p.nombre AS nombre_producto,
        e.ubicacion_id, u.nombre AS nombre_ubicacion, e.cantidad,
        COALESCE(v.cantidad_utilizable,e.cantidad) AS utilizable,
        COALESCE(v.bloqueado,false) AS bloqueado, COALESCE(v.caducado,false) AS caducado,
        e.updated_at${from}${clause} ORDER BY ${p.column} ${p.order}, e.id ASC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.limit, p.offset])).rows;
    return { data: rows.map((row) => ({ lotId: str(row.lot_id), lotCode: str(row.lot_code),
      productId: str(row.producto_id), productName: str(row.nombre_producto),
      locationId: str(row.ubicacion_id), locationName: str(row.nombre_ubicacion),
      physicalQuantity: qty(row.cantidad), usableQuantity: qty(row.utilizable),
      unit: 'KG', blocked: bool(row.bloqueado), expired: bool(row.caducado),
      updatedAt: iso(row.updated_at) })), meta: meta(total, p.page, p.limit) };
  }

  async movements(query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'lotId', 'locationId', 'type',
      'productionOrderId', 'distributionId', 'dateFrom', 'dateTo']);
    const where: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of [['lotId', 'm.lote_id'], ['locationId', 'm.ubicacion_id'],
      ['productionOrderId', 'm.orden_produccion_id'], ['distributionId', 'm.distribucion_id']] as const) {
      if (query[key] !== undefined) {
        values.push(requireId(String(query[key])));
        where.push(`${column} = $${values.length}`);
      }
    }
    if (query.type !== undefined) { values.push(String(query.type)); where.push(`m.tipo = $${values.length}`); }
    const { from, to } = dateRange(query);
    if (from) { values.push(from); where.push(`m.fecha_movimiento >= $${values.length}`); }
    if (to) { values.push(to); where.push(`m.fecha_movimiento < $${values.length}`); }
    const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const fromSql = ` FROM movimientos m JOIN lotes l ON l.id=m.lote_id
      JOIN ubicaciones u ON u.id=m.ubicacion_id JOIN productos p ON p.id=l.producto_id`;
    const p = paging(query, { movementAt: 'm.fecha_movimiento', createdAt: 'm.created_at' }, 'movementAt');
    const total = Number((await this.sql.pool.query<{ total: string }>(
      `SELECT count(*)::text AS total${fromSql}${clause}`, values)).rows[0].total);
    const rows = (await this.sql.pool.query<Row>(
      `SELECT m.*, l.codigo AS lot_code, p.unidad_medida${fromSql}${clause}
       ORDER BY ${p.column} ${p.order}, m.id ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.limit, p.offset])).rows;
    return { data: rows.map((row) => ({ id: str(row.id), lotId: str(row.lote_id),
      locationId: str(row.ubicacion_id), type: str(row.tipo), direction: str(row.sentido) as 'ENTRADA' | 'SALIDA',
      quantity: qty(row.cantidad), beforeQuantity: qty(row.cantidad_anterior),
      afterQuantity: qty(row.cantidad_posterior), unit: str(row.unidad_medida),
      productionOrderId: nullableStr(row.orden_produccion_id),
      distributionId: nullableStr(row.distribucion_id), actorId: str(row.usuario_id),
      movementAt: iso(row.fecha_movimiento), createdAt: iso(row.created_at) })),
    meta: meta(total, p.page, p.limit) };
  }

  async productionOrders(query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'search', 'locationId', 'dateFrom', 'dateTo']);
    const where: string[] = [];
    const values: unknown[] = [];
    const term = search(query.search);
    if (term) { values.push(`%${term}%`); where.push(`(o.codigo ILIKE $${values.length} OR o.nombre ILIKE $${values.length})`); }
    if (query.locationId !== undefined) {
      values.push(requireId(String(query.locationId))); where.push(`o.ubicacion_id = $${values.length}`);
    }
    const { from, to } = dateRange(query);
    if (from) { values.push(from); where.push(`o.fecha_produccion >= $${values.length}`); }
    if (to) { values.push(to); where.push(`o.fecha_produccion < $${values.length}`); }
    const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const p = paging(query, { producedAt: 'o.fecha_produccion', code: 'o.codigo' }, 'producedAt');
    const total = Number((await this.sql.pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM ordenes_produccion o${clause}`, values)).rows[0].total);
    const rows = (await this.sql.pool.query<Row>(
      `SELECT o.*, (SELECT count(*)::int FROM consumos_produccion c WHERE c.orden_produccion_id=o.id) AS inputs,
        (SELECT count(*)::int FROM resultados_produccion r WHERE r.orden_produccion_id=o.id) AS outputs,
        EXISTS(SELECT 1 FROM eventos_sincronizacion e WHERE e.entidad_id=o.id
          AND e.motor_destino='NEO4J' AND e.estado<>'COMPLETADO') AS sync_pending
        FROM ordenes_produccion o${clause} ORDER BY ${p.column} ${p.order}, o.id ASC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.limit, p.offset])).rows;
    return { data: rows.map((row) => ({ id: str(row.id), code: str(row.codigo), name: str(row.nombre),
      locationId: str(row.ubicacion_id), producedAt: iso(row.fecha_produccion),
      inputCount: Number(row.inputs), outputCount: Number(row.outputs),
      graphSyncStatus: bool(row.sync_pending) ? 'PENDIENTE' : 'SINCRONIZADO' })),
    meta: meta(total, p.page, p.limit) };
  }

  async productionOrder(id: string) {
    const orderId = requireId(id);
    const row = (await this.sql.pool.query<Row>(
      `SELECT o.*, EXISTS(SELECT 1 FROM eventos_sincronizacion e WHERE e.entidad_id=o.id
        AND e.estado<>'COMPLETADO') AS sync_pending FROM ordenes_produccion o WHERE o.id=$1`, [orderId])).rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    const inputs = (await this.sql.pool.query<Row>(`SELECT c.id,c.lote_id,c.cantidad,l.codigo,p.unidad_medida
      FROM consumos_produccion c JOIN lotes l ON l.id=c.lote_id
      JOIN productos p ON p.id=l.producto_id WHERE c.orden_produccion_id=$1 ORDER BY l.codigo`, [orderId])).rows;
    const outputs = (await this.sql.pool.query<Row>(`SELECT r.id,r.lote_id,r.cantidad,l.codigo,
      l.producto_id,l.fecha_caducidad,p.unidad_medida
      FROM resultados_produccion r JOIN lotes l ON l.id=r.lote_id
      JOIN productos p ON p.id=l.producto_id WHERE r.orden_produccion_id=$1 ORDER BY l.codigo`, [orderId])).rows;
    return { data: { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
      locationId: str(row.ubicacion_id), producedAt: iso(row.fecha_produccion),
      notes: nullableStr(row.observaciones), actorId: str(row.usuario_id), createdAt: iso(row.created_at),
      inputCount: inputs.length, outputCount: outputs.length,
      graphSyncStatus: bool(row.sync_pending) ? 'PENDIENTE' : 'SINCRONIZADO',
      inputs: inputs.map((item) => ({ id: str(item.id), lotId: str(item.lote_id),
        lotCode: str(item.codigo), quantity: qty(item.cantidad), unit: str(item.unidad_medida) })),
      outputs: outputs.map((item) => ({ id: str(item.id), lotId: str(item.lote_id),
        lotCode: str(item.codigo), productId: str(item.producto_id),
        quantity: qty(item.cantidad), expirationDate: nullableStr(item.fecha_caducidad)?.slice(0, 10) ?? null,
        unit: str(item.unidad_medida) })) } };
  }

  async distributions(query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'search', 'originLocationId',
      'destinationLocationId', 'lotId', 'dateFrom', 'dateTo']);
    const where: string[] = [];
    const values: unknown[] = [];
    const term = search(query.search);
    if (term) { values.push(`%${term}%`); where.push(`d.codigo ILIKE $${values.length}`); }
    for (const [key, column] of [['originLocationId', 'd.ubicacion_origen_id'],
      ['destinationLocationId', 'd.ubicacion_destino_id']] as const) {
      if (query[key] !== undefined) {
        values.push(requireId(String(query[key]))); where.push(`${column} = $${values.length}`);
      }
    }
    if (query.lotId !== undefined) {
      values.push(requireId(String(query.lotId)));
      where.push(`EXISTS (SELECT 1 FROM detalle_distribuciones dd WHERE dd.distribucion_id=d.id
        AND dd.lote_id = $${values.length})`);
    }
    const { from, to } = dateRange(query);
    if (from) { values.push(from); where.push(`d.fecha_distribucion >= $${values.length}`); }
    if (to) { values.push(to); where.push(`d.fecha_distribucion < $${values.length}`); }
    const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const p = paging(query, { distributedAt: 'd.fecha_distribucion', code: 'd.codigo' }, 'distributedAt');
    const total = Number((await this.sql.pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM distribuciones d${clause}`, values)).rows[0].total);
    const rows = (await this.sql.pool.query<Row>(
      `SELECT d.*, (SELECT count(*)::int FROM detalle_distribuciones dd WHERE dd.distribucion_id=d.id) AS items,
        EXISTS(SELECT 1 FROM eventos_sincronizacion e WHERE e.entidad_id=d.id
          AND e.estado<>'COMPLETADO') AS sync_pending
        FROM distribuciones d${clause} ORDER BY ${p.column} ${p.order}, d.id ASC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.limit, p.offset])).rows;
    return { data: rows.map((row) => ({ id: str(row.id), code: str(row.codigo),
      originLocationId: str(row.ubicacion_origen_id), destinationLocationId: str(row.ubicacion_destino_id),
      distributedAt: iso(row.fecha_distribucion), itemCount: Number(row.items),
      graphSyncStatus: bool(row.sync_pending) ? 'PENDIENTE' : 'SINCRONIZADO' })),
    meta: meta(total, p.page, p.limit) };
  }

  async distribution(id: string) {
    const distId = requireId(id);
    const row = (await this.sql.pool.query<Row>('SELECT * FROM distribuciones WHERE id=$1', [distId])).rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    const items = (await this.sql.pool.query<Row>(`SELECT dd.*, l.codigo AS lot_code, p.unidad_medida
      FROM detalle_distribuciones dd JOIN lotes l ON l.id=dd.lote_id
      JOIN productos p ON p.id=l.producto_id WHERE dd.distribucion_id=$1 ORDER BY l.codigo`, [distId])).rows;
    return { data: { id: str(row.id), code: str(row.codigo),
      originLocationId: str(row.ubicacion_origen_id), destinationLocationId: str(row.ubicacion_destino_id),
      distributedAt: iso(row.fecha_distribucion), notes: nullableStr(row.observaciones),
      actorId: str(row.usuario_id), createdAt: iso(row.created_at), itemCount: items.length,
      graphSyncStatus: 'SINCRONIZADO',
      items: items.map((item) => ({ id: str(item.id), lotId: str(item.lote_id),
        lotCode: str(item.lot_code), quantity: qty(item.cantidad), unit: str(item.unidad_medida) })) } };
  }

  private mapInspection(doc: Document & { _id: string }) {
    const parameters = Object.fromEntries(Object.entries(
      (doc.parametros as Record<string, unknown> | undefined) ?? {}).map(([key, value]) =>
      [key, bson(value)]));
    return { id: str(doc._id), code: str(doc.codigo), lotId: str(doc.lote_id),
      productId: str(doc.producto_id), templateId: str(doc.plantilla_id),
      templateVersion: Number(doc.plantilla_version), inspectorId: str(doc.inspector_id),
      inspectedAt: iso(doc.fecha_inspeccion),
      parameters: parameters as Record<string, string | number | boolean>,
      result: str(doc.resultado) as 'CONFORME' | 'NO_CONFORME',
      findings: ((doc.hallazgos as Row[] | undefined) ?? []).map((item) => ({
        type: str(item.tipo), parameter: nullableStr(item.parametro),
        description: str(item.descripcion), severity: str(item.severidad),
      })),
      notes: nullableStr(doc.observaciones),
      evidence: ((doc.evidencias as Row[] | undefined) ?? []).map((item) => ({
        type: str(item.tipo), reference: str(item.referencia),
        description: nullableStr(item.descripcion), registeredAt: iso(item.fecha_registro),
      })),
      createdAt: iso(doc.created_at), findingsCount: ((doc.hallazgos as unknown[] | undefined) ?? []).length };
  }

  async inspections(query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'lotId', 'productId', 'result', 'dateFrom', 'dateTo']);
    const filter: Row = {};
    for (const key of ['lotId', 'productId']) {
      if (query[key] !== undefined) filter[key === 'lotId' ? 'lote_id' : 'producto_id'] = requireId(String(query[key]));
    }
    if (query.result !== undefined) {
      if (!['CONFORME', 'NO_CONFORME'].includes(String(query.result))) throw new Error('VALIDATION_ERROR');
      filter.resultado = String(query.result);
    }
    const { from, to } = dateRange(query);
    if (from || to) {
      filter.fecha_inspeccion = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lt: new Date(to) } : {}),
      };
    }
    const collection = this.mongo.db.collection<Document & { _id: string }>('inspecciones_calidad');
    const total = await collection.countDocuments(filter);
    const p = paging(query, { inspectedAt: 'fecha_inspeccion', code: 'codigo' }, 'inspectedAt');
    const sortField = p.column === 'codigo' ? 'codigo' : 'fecha_inspeccion';
    const rows = await collection.find(filter).sort({ [sortField]: p.order === 'ASC' ? 1 : -1, _id: 1 })
      .skip(p.offset).limit(p.limit).toArray();
    return { data: rows.map((row) => this.mapInspection(row)), meta: meta(total, p.page, p.limit) };
  }

  async inspection(id: string) {
    const doc = await this.mongo.db.collection<Document & { _id: string }>('inspecciones_calidad')
      .findOne({ _id: requireId(id) });
    if (!doc) throw new Error('RESOURCE_NOT_FOUND');
    return { data: this.mapInspection(doc) };
  }

  private mapTemplate(doc: Document & { _id: string }) {
    return { id: str(doc._id), code: str(doc.codigo), name: str(doc.nombre),
      description: nullableStr(doc.descripcion), productId: nullableStr(doc.producto_id),
      version: Number(doc.version), active: bool(doc.activo), createdAt: iso(doc.created_at),
      parameters: ((doc.parametros as Row[] | undefined) ?? []).map((item) => ({
        key: str(item.key), label: str(item.label), dataType: str(item.dataType),
        unit: nullableStr(item.unit), required: bool(item.required),
        options: (item.options as string[] | undefined) ?? [],
        min: item.min == null ? null : String(item.min),
        max: item.max == null ? null : String(item.max),
      })) };
  }

  async activeTemplate(productId: string) {
    const product = requireId(productId);
    const collection = this.mongo.db.collection<Document & { _id: string }>('plantillas_inspeccion');
    let doc = await collection.findOne({ producto_id: product, activo: true });
    if (!doc) doc = await collection.findOne({ producto_id: null, activo: true });
    if (!doc) throw new Error('TEMPLATE_UNAVAILABLE');
    return { data: this.mapTemplate(doc) };
  }

  async template(id: string) {
    const doc = await this.mongo.db.collection<Document & { _id: string }>('plantillas_inspeccion')
      .findOne({ _id: requireId(id) });
    if (!doc) throw new Error('RESOURCE_NOT_FOUND');
    return { data: this.mapTemplate(doc) };
  }

  private async allInspections(query: Query) {
    allow(query, ['productId', 'dateFrom', 'dateTo']);
    const filter: Row = {};
    if (query.productId !== undefined) filter.producto_id = requireId(String(query.productId));
    const { from, to } = dateRange(query);
    if (from || to) {
      filter.fecha_inspeccion = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lt: new Date(to) } : {}),
      };
    }
    return this.mongo.db.collection<Document & { _id: string }>('inspecciones_calidad')
      .find(filter).toArray();
  }

  async qualitySummary(query: Query) {
    const docs = await this.allInspections(query);
    const productIds = [...new Set(docs.map((doc) => str(doc.producto_id)))];
    const names = productIds.length ? (await this.sql.pool.query<Row>(
      `SELECT id,nombre FROM productos WHERE id=ANY($1)`, [productIds])).rows : [];
    const nameById = new Map(names.map((row) => [str(row.id), str(row.nombre)]));
    const count = (list: (Document & { _id: string })[], result: string) =>
      list.filter((doc) => str(doc.resultado) === result).length;
    const total = docs.length;
    const conforming = count(docs, 'CONFORME');
    const nonConforming = count(docs, 'NO_CONFORME');
    const byProduct = [...new Set(docs.map((doc) => str(doc.producto_id)))].map((productId) => {
      const subset = docs.filter((doc) => str(doc.producto_id) === productId);
      const bad = count(subset, 'NO_CONFORME');
      return { productId, productName: nameById.get(productId) ?? '', total: subset.length,
        conforming: count(subset, 'CONFORME'), nonConforming: bad,
        nonConformingPercentage: subset.length === 0 ? null : Number((bad / subset.length * 100).toFixed(2)) };
    }).sort((a, b) => a.productName.localeCompare(b.productName));
    return { data: { totalInspections: total, conforming, nonConforming,
      nonConformingPercentage: total === 0 ? null : Number((nonConforming / total * 100).toFixed(2)),
      byProduct } };
  }

  async qualityFindings(query: Query) {
    allow(query, ['productId', 'dateFrom', 'dateTo', 'groupBy', 'limit']);
    if (query.groupBy !== undefined && !['type', 'severity'].includes(String(query.groupBy))) {
      throw new Error('VALIDATION_ERROR');
    }
    const limitRaw = query.limit === undefined ? 20 : Number(query.limit);
    if (!Number.isSafeInteger(limitRaw) || limitRaw < 1 || limitRaw > 100) throw new Error('VALIDATION_ERROR');
    const docs = await this.allInspections({ productId: query.productId,
      dateFrom: query.dateFrom, dateTo: query.dateTo });
    const counts = new Map<string, number>();
    for (const doc of docs) {
      for (const finding of ((doc.hallazgos as Row[] | undefined) ?? [])) {
        const key = str(query.groupBy === 'severity' ? finding.severidad : finding.tipo);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return { data: [...counts].map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)))
      .slice(0, limitRaw) };
  }

  private mapIncident(row: Row) {
    return { id: str(row.id), code: str(row.codigo), originLotId: str(row.lote_origen_id),
      title: str(row.titulo), type: str(row.tipo), severity: str(row.severidad),
      status: str(row.estado), dossierStatus: str(row.estado_expediente),
      reportedBy: str(row.reportado_por), detectedAt: iso(row.fecha_deteccion),
      createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
      closedAt: nullableIso(row.fecha_cierre), closedBy: nullableStr(row.cerrado_por),
      resolution: nullableStr(row.resolucion) };
  }

  async incidents(query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'search', 'status', 'severity',
      'originLotId', 'dateFrom', 'dateTo']);
    const where: string[] = [];
    const values: unknown[] = [];
    const term = search(query.search);
    if (term) { values.push(`%${term}%`); where.push(`(titulo ILIKE $${values.length} OR codigo ILIKE $${values.length})`); }
    for (const [key, column, allowed] of [
      ['status', 'estado', ['ABIERTA', 'EN_ANALISIS', 'CERRADA']],
      ['severity', 'severidad', ['BAJA', 'MEDIA', 'ALTA']],
    ] as const) {
      if (query[key] !== undefined) {
        if (!(allowed as readonly string[]).includes(String(query[key]))) throw new Error('VALIDATION_ERROR');
        values.push(query[key]); where.push(`${column} = $${values.length}`);
      }
    }
    if (query.originLotId !== undefined) {
      values.push(requireId(String(query.originLotId))); where.push(`lote_origen_id = $${values.length}`);
    }
    const { from, to } = dateRange(query);
    if (from) { values.push(from); where.push(`fecha_deteccion >= $${values.length}`); }
    if (to) { values.push(to); where.push(`fecha_deteccion < $${values.length}`); }
    const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const p = paging(query, { detectedAt: 'fecha_deteccion', code: 'codigo' }, 'detectedAt');
    const total = Number((await this.sql.pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM incidencias${clause}`, values)).rows[0].total);
    const rows = (await this.sql.pool.query<Row>(
      `SELECT * FROM incidencias${clause} ORDER BY ${p.column} ${p.order}, id ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, p.limit, p.offset])).rows;
    return { data: rows.map((row) => this.mapIncident(row)), meta: meta(total, p.page, p.limit) };
  }

  async incident(id: string) {
    const row = (await this.sql.pool.query<Row>('SELECT * FROM incidencias WHERE id=$1',
      [requireId(id)])).rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    const incidentId = str(row.id);
    const doc = await this.mongo.db.collection<Document & { _id: string }>('expedientes_incidencias')
      .findOne({ incidencia_id: incidentId });
    const blocks = await this.blockRows({ incidentId });
    return { data: { ...this.mapIncident(row),
      dossier: doc ? this.templateDossier(doc) : {
        dossierStatus: str(row.estado_expediente), status: 'PARCIAL', dossier: null,
        inspections: null, warnings: [],
      },
      blocks: blocks.map((item) => this.block(item)), sourceStatus: {
        postgresql: { availability: 'AVAILABLE', sync: 'NOT_APPLICABLE',
          checkedAt: new Date().toISOString(), pendingEvents: null },
        mongodb: { availability: doc ? 'AVAILABLE' : 'UNAVAILABLE',
          sync: doc ? 'SYNCHRONIZED' : 'PENDING', checkedAt: new Date().toISOString(), pendingEvents: null },
        neo4j: null,
      } } };
  }

  private templateDossier(doc: Document & { _id: string }) {
    return { dossierStatus: 'SINCRONIZADO', status: 'COMPLETO',
      dossier: { id: str(doc._id), incidentId: str(doc.incidencia_id),
        description: str(doc.descripcion), inspectionIds: (doc.inspecciones_ids as string[] | undefined) ?? [],
        findings: ((doc.hallazgos as Row[] | undefined) ?? []).map((item) => ({
          type: str(item.tipo), parameter: nullableStr(item.parametro),
          description: str(item.descripcion), severity: str(item.severidad) })),
        evidence: ((doc.evidencias as Row[] | undefined) ?? []).map((item) => ({
          type: str(item.tipo), reference: str(item.referencia),
          description: nullableStr(item.descripcion), registeredAt: iso(item.fecha_registro) })),
        notes: nullableStr(doc.observaciones), detailedResolution: nullableStr(doc.resolucion_detallada),
        version: Number(doc.version), createdAt: iso(doc.created_at), updatedAt: iso(doc.updated_at) },
      inspections: null, warnings: [] };
  }

  async dossier(id: string) {
    const incidentId = requireId(id);
    const row = (await this.sql.pool.query<Row>(
      'SELECT estado_expediente FROM incidencias WHERE id=$1', [incidentId])).rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    const doc = await this.mongo.db.collection<Document & { _id: string }>('expedientes_incidencias')
      .findOne({ incidencia_id: incidentId });
    return { data: doc ? this.templateDossier(doc) : {
      dossierStatus: str(row.estado_expediente), status: 'PARCIAL', dossier: null,
      inspections: null, warnings: [{ code: 'DOCUMENT_PENDING', message: 'Expediente pendiente.' }],
    } };
  }

  private async blockRows(filter: { incidentId?: string; lotId?: string; active?: boolean | null }) {
    const where: string[] = [];
    const values: unknown[] = [];
    if (filter.incidentId) { values.push(filter.incidentId); where.push(`incidencia_id = $${values.length}`); }
    if (filter.lotId) { values.push(filter.lotId); where.push(`lote_id = $${values.length}`); }
    if (filter.active === true) where.push('activo = true');
    if (filter.active === false) where.push('activo = false');
    const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    return (await this.sql.pool.query<Row>(`SELECT * FROM bloqueos_lotes${clause} ORDER BY fecha_bloqueo DESC, id`,
      values)).rows;
  }

  private block(row: Row) {
    return { id: str(row.id), lotId: str(row.lote_id), incidentId: str(row.incidencia_id),
      reason: str(row.motivo), blockedBy: str(row.bloqueado_por), blockedAt: iso(row.fecha_bloqueo),
      active: bool(row.activo), releasedBy: nullableStr(row.desbloqueado_por),
      releasedAt: nullableIso(row.fecha_desbloqueo), releaseReason: nullableStr(row.motivo_desbloqueo) };
  }

  async incidentBlocks(id: string, query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'active']);
    const active = boolParam(query.active);
    const rows = await this.blockRows({ incidentId: requireId(id), active });
    const p = paging(query, { blockedAt: 'fecha_bloqueo' }, 'blockedAt');
    const sorted = [...rows].sort((a, b) => p.order === 'ASC'
      ? Date.parse(String(a.fecha_bloqueo)) - Date.parse(String(b.fecha_bloqueo))
      : Date.parse(String(b.fecha_bloqueo)) - Date.parse(String(a.fecha_bloqueo)));
    return { data: sorted.slice(p.offset, p.offset + p.limit).map((row) => this.block(row)),
      meta: meta(rows.length, p.page, p.limit) };
  }

  async lotBlocks(id: string, query: Query) {
    allow(query, ['page', 'limit', 'sortBy', 'sortOrder', 'active']);
    const active = boolParam(query.active);
    const rows = await this.blockRows({ lotId: requireId(id), active });
    const p = paging(query, { blockedAt: 'fecha_bloqueo' }, 'blockedAt');
    const sorted = [...rows].sort((a, b) => p.order === 'ASC'
      ? Date.parse(String(a.fecha_bloqueo)) - Date.parse(String(b.fecha_bloqueo))
      : Date.parse(String(b.fecha_bloqueo)) - Date.parse(String(a.fecha_bloqueo)));
    return { data: sorted.slice(p.offset, p.offset + p.limit).map((row) => this.block(row)),
      meta: meta(rows.length, p.page, p.limit) };
  }

  async lotDetails(id: string) {
    const lotId = requireId(id);
    const lot = await this.lot(lotId);
    const supplierId = lot.data.supplierId;
    const supplier = supplierId ? (await this.sql.pool.query<Row>(
      'SELECT id,codigo,nombre,activo FROM proveedores WHERE id=$1', [supplierId])).rows[0] : undefined;
    const stocks = (await this.sql.pool.query<Row>(`SELECT e.lote_id,l.codigo AS lot_code,l.producto_id,
      p.nombre AS nombre_producto,e.ubicacion_id,u.nombre AS nombre_ubicacion,e.cantidad,
      COALESCE(v.cantidad_utilizable,e.cantidad) AS utilizable,COALESCE(v.bloqueado,false) AS bloqueado,
      COALESCE(v.caducado,false) AS caducado,e.updated_at
      FROM existencias e JOIN lotes l ON l.id=e.lote_id JOIN productos p ON p.id=l.producto_id
      JOIN ubicaciones u ON u.id=e.ubicacion_id
      LEFT JOIN v_inventario v ON v.lote_id=e.lote_id AND v.ubicacion_id=e.ubicacion_id
      WHERE e.lote_id=$1 ORDER BY e.ubicacion_id`, [lotId])).rows;
    const inspections = await this.inspections({ lotId, limit: '50' });
    const blocks = await this.blockRows({ lotId, active: true });
    const incidents = (await this.sql.pool.query<Row>(
      'SELECT * FROM incidencias WHERE lote_origen_id=$1 ORDER BY fecha_deteccion DESC LIMIT 50', [lotId])).rows;
    return { data: { lot: lot.data,
      supplier: supplier ? { id: str(supplier.id), code: str(supplier.codigo),
        name: str(supplier.nombre), active: bool(supplier.activo) } : null,
      stocks: { status: 'COMPLETO', data: stocks.map((row) => ({ lotId: str(row.lote_id),
        lotCode: str(row.lot_code), productId: str(row.producto_id), productName: str(row.nombre_producto),
        locationId: str(row.ubicacion_id), locationName: str(row.nombre_ubicacion),
        physicalQuantity: qty(row.cantidad), usableQuantity: qty(row.utilizable),
        unit: 'KG', blocked: bool(row.bloqueado), expired: bool(row.caducado),
        updatedAt: iso(row.updated_at) })), warnings: [] },
      quality: { status: 'COMPLETO', data: { lotId, totalInspections: inspections.meta.total,
        conforming: inspections.data.filter((item) => item.result === 'CONFORME').length,
        nonConforming: inspections.data.filter((item) => item.result === 'NO_CONFORME').length,
        latestInspectionId: inspections.data[0]?.id ?? null }, warnings: [] },
      genealogy: { status: 'NO_DISPONIBLE', data: null, warnings: [] },
      incidents: incidents.map((row) => this.mapIncident(row)),
      activeBlocks: blocks.map((row) => this.block(row)),
      sourceStatus: { postgresql: { availability: 'AVAILABLE', sync: 'NOT_APPLICABLE',
        checkedAt: new Date().toISOString(), pendingEvents: null }, mongodb: null, neo4j: null },
      status: 'PARCIAL', warnings: [{ code: 'GRAPH_UNAVAILABLE',
        message: 'La genealogía se consulta en /traceability.' }] } };
  }

  async dashboardSummary() {
    const row = (await this.sql.pool.query<Row>(`SELECT
      (SELECT count(*)::int FROM lotes) AS lots,
      (SELECT count(*)::int FROM ordenes_produccion) AS productions,
      (SELECT count(*)::int FROM incidencias WHERE estado<>'CERRADA') AS incidents,
      (SELECT count(DISTINCT lote_id)::int FROM bloqueos_lotes WHERE activo) AS blocked`)).rows[0];
    return { data: { totalLots: Number(row.lots), totalProductions: Number(row.productions),
      activeIncidents: Number(row.incidents), blockedLots: Number(row.blocked) } };
  }

  async recentActivity(query: Query) {
    allow(query, ['limit']);
    const limitRaw = query.limit === undefined ? 10 : Number(query.limit);
    if (!Number.isSafeInteger(limitRaw) || limitRaw < 1 || limitRaw > 50) throw new Error('VALIDATION_ERROR');
    const rows = (await this.sql.pool.query<Row>(`SELECT 'RECEPCION' AS type, id, codigo,
      fecha_origen AS occurred_at, 'Lote recibido' AS description FROM lotes WHERE tipo_origen='RECEPCION'
      UNION ALL SELECT 'PRODUCCION', id, codigo, fecha_produccion, 'Orden completada' FROM ordenes_produccion
      UNION ALL SELECT 'DISTRIBUCION', id, codigo, fecha_distribucion, 'Transferencia completada' FROM distribuciones
      UNION ALL SELECT 'INCIDENCIA', id, codigo, fecha_deteccion, titulo FROM incidencias
      ORDER BY occurred_at DESC LIMIT $1`, [limitRaw])).rows;
    return { data: rows.map((row) => ({ type: str(row.type) as 'RECEPCION' | 'PRODUCCION' | 'DISTRIBUCION' | 'INCIDENCIA',
      entityId: str(row.id), code: str(row.codigo), occurredAt: iso(row.occurred_at),
      description: str(row.description) })) };
  }

  /** Alta de catálogo y evento de proyección en la misma transacción SQL. */
  private async createCatalog<T>(sql: string, params: unknown[], eventType: string,
    entityType: 'SUPPLIER' | 'PRODUCT' | 'LOCATION',
    eventPayload: (row: Row) => Record<string, unknown>, shape: (row: Row) => T): Promise<T> {
    const client = await this.sql.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(sql, params);
      const row = result.rows[0];
      await createOutboxWriter().enqueue({
        eventId: randomUUID(), eventType, entityType, entityId: str(row.id),
        destination: 'NEO4J', payload: eventPayload(row),
      }, client);
      await client.query('COMMIT');
      return shape(row);
    } catch (error) {
      await client.query('ROLLBACK');
      if (String(error).includes('unique')) throw new Error('DUPLICATE_CODE');
      throw error;
    } finally {
      client.release();
    }
  }

  async createSupplier(body: Query) {
    const code = validateCode(body.code);
    const name = validateText(body.name, 150);
    return this.createCatalog(
      'INSERT INTO proveedores(codigo,nombre) VALUES($1,$2) RETURNING *', [code, name],
      'PROVEEDOR_CREADO', 'SUPPLIER',
      (row) => ({ supplier: { id: str(row.id), code: str(row.codigo),
        name: str(row.nombre), active: bool(row.activo) } }),
      (row) => ({ data: this.supplierShape(row) }));
  }

  async createProduct(body: Query) {
    const code = validateCode(body.code);
    const name = validateText(body.name, 150);
    const type = String(body.type);
    const unit = String(body.unit);
    if (!['MATERIA_PRIMA', 'INTERMEDIO', 'TERMINADO'].includes(type) ||
        !['KG', 'G', 'L', 'ML', 'UNIDAD'].includes(unit)) throw new Error('VALIDATION_ERROR');
    return this.createCatalog(
      `INSERT INTO productos(codigo,nombre,descripcion,tipo,unidad_medida)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [code, name, body.description ?? null, type, unit],
      'PRODUCTO_CREADO', 'PRODUCT',
      (row) => ({ product: { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
        type: str(row.tipo), unit: str(row.unidad_medida), active: bool(row.activo) } }),
      (row) => ({ data: { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
        description: nullableStr(row.descripcion), type: str(row.tipo),
        unit: str(row.unidad_medida), active: bool(row.activo),
        createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) } }));
  }

  async createLocation(body: Query) {
    const code = validateCode(body.code);
    const name = validateText(body.name, 150);
    const type = String(body.type);
    if (!['ALMACEN', 'PLANTA_PRODUCCION', 'SUCURSAL'].includes(type)) throw new Error('VALIDATION_ERROR');
    return this.createCatalog(
      `INSERT INTO ubicaciones(codigo,nombre,tipo,direccion) VALUES($1,$2,$3,$4) RETURNING *`,
      [code, name, type, body.address ?? null],
      'UBICACION_CREADA', 'LOCATION',
      (row) => ({ location: { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
        type: str(row.tipo), active: bool(row.activo) } }),
      (row) => ({ data: { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
        type: str(row.tipo), address: nullableStr(row.direccion), active: bool(row.activo),
        createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) } }));
  }

  private supplierShape(row: Row) {
    return { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
      contactName: nullableStr(row.contacto), email: nullableStr(row.correo),
      phone: nullableStr(row.telefono), address: nullableStr(row.direccion),
      active: bool(row.activo), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
  }

  async patchCatalogStatus(kind: 'suppliers' | 'products' | 'locations', id: string, body: Query) {
    if (body.active !== true && body.active !== false) throw new Error('VALIDATION_ERROR');
    const table = kind === 'suppliers' ? 'proveedores' : kind === 'products' ? 'productos' : 'ubicaciones';
    const result = await this.sql.pool.query<Row>(
      `UPDATE ${table} SET activo=$1, updated_at=now() WHERE id=$2 RETURNING *`,
      [body.active, requireId(id)]);
    if (!result.rows[0]) throw new Error('RESOURCE_NOT_FOUND');
    const row = result.rows[0];
    const data = kind === 'suppliers' ? this.supplierShape(row) : kind === 'products'
      ? { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
        description: nullableStr(row.descripcion), type: str(row.tipo),
        unit: str(row.unidad_medida), active: bool(row.activo),
        createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) }
      : { id: str(row.id), code: str(row.codigo), name: str(row.nombre),
        type: str(row.tipo), address: nullableStr(row.direccion), active: bool(row.activo),
        createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
    return { data };
  }

  async systemStatus() {
    const sync = (await this.sql.pool.query<Row>(`SELECT motor_destino AS destination,
      count(*) FILTER (WHERE estado='PENDIENTE')::int AS pending,
      count(*) FILTER (WHERE estado='PROCESANDO')::int AS processing,
      count(*) FILTER (WHERE estado='FALLIDO')::int AS failed,
      count(*) FILTER (WHERE estado='COMPLETADO')::int AS completed,
      max(processed_at) AS last_processed,
      max(secuencia) FILTER (WHERE estado='COMPLETADO')::text AS last_sequence,
      max(secuencia)::text AS head_sequence
      FROM eventos_sincronizacion GROUP BY motor_destino ORDER BY motor_destino`)).rows;
    let mongoAvailable = true;
    try { await this.mongo.db.command({ ping: 1 }); } catch { mongoAvailable = false; }
    let neoAvailable = true;
    try { await this.graph.executeQuery('RETURN 1 AS ok', {}, { database: this.config.NEO4J_DATABASE }); }
    catch { neoAvailable = false; }
    const status = mongoAvailable && neoAvailable &&
      sync.every((row) => Number(row.failed) === 0) ? 'AVAILABLE' : 'DEGRADED';
    const source = (available: boolean) => ({ availability: available ? 'AVAILABLE' : 'UNAVAILABLE',
      sync: available ? 'SYNCHRONIZED' : 'ERROR', checkedAt: new Date().toISOString(),
      pendingEvents: null });
    return { data: { status, sources: { postgresql: source(true), mongodb: source(mongoAvailable),
      neo4j: source(neoAvailable) },
      sync: sync.map((row) => ({ destination: str(row.destination),
        pending: Number(row.pending), processing: Number(row.processing),
        failed: Number(row.failed), completed: Number(row.completed),
        lastProcessedAt: nullableIso(row.last_processed),
        lastCompletedSequence: nullableStr(row.last_sequence),
        headSequence: nullableStr(row.head_sequence),
        status: Number(row.failed) > 0 ? 'ERROR' : Number(row.pending) + Number(row.processing) > 0
          ? 'PENDING' : 'SYNCHRONIZED' })) } };
  }
}
