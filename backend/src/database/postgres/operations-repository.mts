import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  createIdempotencyStore, createInventoryWriter, createOutboxWriter, createTransactionManager,
  type PgClientLike, type Tx,
} from './transaction.mts';
import type { OperationsDeps } from '../../modules/operations/operations.mts';

function row(result: { rows: Record<string, unknown>[] }) {
  return result.rows[0] ?? null;
}
function active(result: { rows: Record<string, unknown>[] }) {
  const item = row(result);
  return item ? { id: String(item.id), active: item.activo === true } : null;
}

/** Adaptador SQL único para los puertos existentes de operaciones. */
export function createSqlOperationsDeps(pool: Pool, now: () => string = () => new Date().toISOString()): OperationsDeps {
  const transaction = createTransactionManager({
    connect: async (): Promise<PgClientLike> => {
      const client = await pool.connect();
      return {
        query: async (sql, params) => {
          const result = await client.query<Record<string, unknown>>(sql, params);
          return { rows: result.rows, rowCount: result.rowCount ?? 0 };
        },
        release: async () => { client.release(); },
      };
    },
  });
  const inventory = createInventoryWriter();
  return {
    transaction, inventory, outbox: createOutboxWriter(), idempotencia: createIdempotencyStore(),
    reloj: now, nuevoId: randomUUID,
    catalogo: {
      async producto(id, tx) {
        const result = await tx.query(
          'SELECT id, nombre, activo, tipo, unidad_medida FROM productos WHERE id=$1 FOR SHARE', [id]);
        const item = row(result);
        return item ? { id: String(item.id), name: String(item.nombre), active: item.activo === true,
          type: String(item.tipo), unit: String(item.unidad_medida) } : null;
      },
      async proveedor(id, tx) {
        return active(await tx.query('SELECT id, activo FROM proveedores WHERE id=$1 FOR SHARE', [id]));
      },
      async ubicacion(id, tx) {
        return active(await tx.query('SELECT id, activo FROM ubicaciones WHERE id=$1 FOR SHARE', [id]));
      },
      async insertarProveedor(data, tx) {
        await tx.query('INSERT INTO proveedores (codigo,nombre) VALUES ($1,$2)', [data.code, data.name]);
      },
      async insertarProducto() {
        throw new Error('INVALID_OPERATION: alta de productos exige tipo y unidad');
      },
      async insertarUbicacion() {
        throw new Error('INVALID_OPERATION: alta de ubicaciones exige tipo');
      },
    },
    records: {
      async insertLot(data, tx) {
        await tx.query(`INSERT INTO lotes
          (id,codigo,producto_id,proveedor_id,codigo_lote_proveedor,tipo_origen,
           cantidad_inicial,fecha_origen,fecha_caducidad,registrado_por)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [data.id, data.code, data.productId, data.supplierId, data.supplierLotCode ?? null,
          data.supplierId ? 'RECEPCION' : 'PRODUCCION',
          data.quantity, data.at, data.expirationDate, data.actorId]);
      },
      async insertProduction(data, tx) {
        const code = await nextCode(tx, 'codigo_op_seq', 'OP');
        const result = await tx.query(`INSERT INTO ordenes_produccion
          (id,codigo,nombre,ubicacion_id,fecha_produccion,observaciones,usuario_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING created_at`,
        [data.id, code, data.name, data.locationId, data.at, data.notes ?? null, data.actorId]);
        return { code, createdAt: new Date(result.rows[0]!.created_at as string).toISOString() };
      },
      async insertConsumption(id, orderId, lotId, quantity, tx) {
        await tx.query(`INSERT INTO consumos_produccion (id,orden_produccion_id,lote_id,cantidad)
          VALUES ($1,$2,$3,$4)`, [id, orderId, lotId, quantity]);
      },
      async insertResult(id, orderId, lotId, quantity, tx) {
        await tx.query(`INSERT INTO resultados_produccion (id,orden_produccion_id,lote_id,cantidad)
          VALUES ($1,$2,$3,$4)`, [id, orderId, lotId, quantity]);
      },
      async insertDistribution(data, tx) {
        const code = await nextCode(tx, 'codigo_dist_seq', 'DIST');
        const result = await tx.query(`INSERT INTO distribuciones
          (id,codigo,ubicacion_origen_id,ubicacion_destino_id,fecha_distribucion,observaciones,usuario_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING created_at`,
        [data.id, code, data.originId, data.destinationId, data.at, data.notes ?? null, data.actorId]);
        return { code, createdAt: new Date(result.rows[0]!.created_at as string).toISOString() };
      },
      async insertDetail(id, distributionId, lotId, quantity, tx) {
        await tx.query(`INSERT INTO detalle_distribuciones (id,distribucion_id,lote_id,cantidad)
          VALUES ($1,$2,$3,$4)`, [id, distributionId, lotId, quantity]);
      },
      async inputLots(ids, tx) {
        const result = await tx.query(`SELECT l.id, l.codigo, l.fecha_origen::text AS fecha_origen,
          l.fecha_caducidad::text AS fecha_caducidad, p.unidad_medida,
          EXISTS(SELECT 1 FROM bloqueos_lotes b WHERE b.lote_id=l.id AND b.activo) AS bloqueado,
          (SELECT max(m.fecha_movimiento)::text FROM movimientos m WHERE m.lote_id=l.id) AS ultimo_movimiento
          FROM lotes l JOIN productos p ON p.id=l.producto_id WHERE l.id=ANY($1) ORDER BY l.id`, [ids]);
        return new Map(result.rows.map((item) => [String(item.id), {
          code: String(item.codigo), unit: String(item.unidad_medida), originAt: String(item.fecha_origen),
          expirationDate: item.fecha_caducidad === null ? null : String(item.fecha_caducidad),
          blocked: item.bloqueado === true,
          lastMovementAt: item.ultimo_movimiento === null ? null : String(item.ultimo_movimiento),
        }]));
      },
    },
  };
}

async function nextCode(tx: Tx, sequence: 'codigo_op_seq' | 'codigo_dist_seq', prefix: 'OP' | 'DIST') {
  // Nombre de secuencia proviene exclusivamente de constantes internas.
  const result = await tx.query(`SELECT nextval('${sequence}') AS n`);
  return `${prefix}-${String(row(result)?.n).padStart(6, '0')}`;
}
