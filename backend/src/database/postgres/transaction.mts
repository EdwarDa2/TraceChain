/**
 * Capa transaccional de I-1 (REL-02/REL-06).
 * Fuentes: DATA_MODEL.md §2/§3, RN-25/28/119/120, AGENTS.md §2 (locks ordenados).
 * El driver `pg` se inyecta como interfaz estructural: se prueba sin base y se
 * conecta con un PoolClient real cuando BASE-02 esté disponible.
 */

export interface PgClientLike {
  query(sql: string, parametros?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
  release(): Promise<void>;
}

export interface PgPoolLike {
  connect(): Promise<PgClientLike>;
}

export interface Tx {
  query(sql: string, parametros?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
}

export interface TransactionManager {
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

/** Un PoolClient por transacción; COMMIT/ROLLBACK y liberación siempre explícitos. */
export function createTransactionManager(pool: PgPoolLike): TransactionManager {
  return {
    async run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
      const cliente = await pool.connect();
      const tx: Tx = { query: (sql, parametros) => cliente.query(sql, parametros) };
      try {
        await tx.query('BEGIN');
        const resultado = await work(tx);
        await tx.query('COMMIT');
        return resultado;
      } catch (error) {
        await tx.query('ROLLBACK');
        throw error;
      } finally {
        await cliente.release();
      }
    },
  };
}

type Milesimas = bigint;

function aMilesimas(valor: string): Milesimas {
  const coincidencia = /^(-?)(\d+)\.(\d{3})$/.exec(valor);
  if (!coincidencia) throw new Error(`INVALID_QUANTITY: formato ${valor} no válido`);
  const magnitud = BigInt(coincidencia[2]! + coincidencia[3]!);
  return coincidencia[1] === '-' ? -magnitud : magnitud;
}

function desdeMilesimas(valor: Milesimas): string {
  const signo = valor < 0n ? '-' : '';
  const absoluto = valor < 0n ? -valor : valor;
  const texto = absoluto.toString().padStart(4, '0');
  return `${signo}${texto.slice(0, -3)}.${texto.slice(-3)}`;
}

export interface CambioStock {
  lotId: string;
  locationId: string;
  delta: string;
  movementType: string;
  productionOrderId: string | null;
  distributionId: string | null;
  actorId: string;
  movementAt: string;
}

export interface StockResultado {
  cantidad: string;
}

export interface InventoryWriter {
  lockLots(ids: string[], tx: Tx): Promise<void>;
  changeStock(cambio: CambioStock, tx: Tx): Promise<StockResultado>;
}

/** Locks siempre en ordenUUID; stock y movimiento en la misma transacción. */
export function createInventoryWriter(): InventoryWriter {
  return {
    async lockLots(ids, tx) {
      const ordenados = [...new Set(ids)].sort();
      await tx.query('SELECT id FROM lotes WHERE id = ANY($1) ORDER BY id FOR UPDATE', [ordenados]);
    },
    async changeStock(cambio, tx) {
      const delta = aMilesimas(cambio.delta);
      const consulta = await tx.query(
        'SELECT cantidad FROM existencias WHERE lote_id = $1 AND ubicacion_id = $2 FOR UPDATE',
        [cambio.lotId, cambio.locationId],
      );
      const cantidadActual = String(consulta.rows[0]?.cantidad ?? '0.000');
      const resultado = desdeMilesimas(aMilesimas(cantidadActual) + delta);
      if (resultado.startsWith('-')) {
        throw new Error(`INSUFFICIENT_STOCK: lote ${cambio.lotId}`);
      }
      await tx.query(
        'UPDATE existencias SET cantidad = $1, updated_at = now() WHERE lote_id = $2 AND ubicacion_id = $3',
        [resultado, cambio.locationId, cambio.lotId],
      );
      await tx.query(
        `INSERT INTO movimientos
          (lote_id, ubicacion_id, tipo, sentido, cantidad, cantidad_anterior, cantidad_posterior,
           orden_produccion_id, distribucion_id, usuario_id, fecha_movimiento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          cambio.lotId,
          cambio.locationId,
          cambio.movementType,
          delta < 0n ? 'SALIDA' : 'ENTRADA',
          desdeMilesimas(delta < 0n ? -delta : delta),
          cantidadActual,
          resultado,
          cambio.productionOrderId,
          cambio.distributionId,
          cambio.actorId,
          cambio.movementAt,
        ],
      );
      return { cantidad: resultado };
    },
  };
}

export interface EventoOutbox {
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  destination: 'NEO4J' | 'MONGODB';
  payload: Record<string, unknown>;
}

export interface OutboxWriter {
  enqueue(evento: EventoOutbox, tx: Tx): Promise<void>;
}

/** La secuencia la asigna PostgreSQL; el payload conserva siempre payloadVersion 1. */
export function createOutboxWriter(): OutboxWriter {
  return {
    async enqueue(evento, tx) {
      // Serializar la asignación de secuencia hasta COMMIT (RN-120).
      await tx.query('SELECT pg_advisory_xact_lock(82701, 0)');
      await tx.query(
        `INSERT INTO eventos_sincronizacion
          (tipo_evento, entidad_id, motor_destino, payload, estado, tipo_entidad, id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          evento.eventType,
          evento.entityId,
          evento.destination,
          JSON.stringify({ payloadVersion: 1, payload: evento.payload }),
          'PENDIENTE',
          evento.entityType,
          evento.eventId,
        ],
      );
    },
  };
}

export interface SolicitudIdempotente {
  actorId: string;
  operacion: string;
  clave: string;
  hash: string;
}

type RespuestaGuardada = { status: number; body: unknown };

export interface IdempotencyStore {
  reserve(
    solicitud: SolicitudIdempotente,
    cliente: PgClientLike,
  ): { replay: false } | { replay: true; status: number; body: unknown };
  confirm(solicitud: SolicitudIdempotente, status: number, body: unknown, cliente: PgClientLike): Promise<void>;
}

/**
 * Reserva bajo lock transaccional por actor+operación+clave. Solo se guarda la
 * respuesta confirmada (2xx); un hash distinto con la misma clave es conflicto.
 */
export function createIdempotencyStore(): IdempotencyStore {
  const respuestas = new Map<string, { hash: string; respuesta: RespuestaGuardada }>();
  const claveDe = (s: SolicitudIdempotente) => `${s.actorId}|${s.operacion}|${s.clave}`;

  return {
    reserve(solicitud, cliente) {
      void cliente.query(
        'SELECT response_status, response_body FROM solicitudes_idempotentes WHERE usuario_id = $1 AND operacion = $2 AND clave = $3 FOR UPDATE',
        [solicitud.actorId, solicitud.operacion, solicitud.clave],
      );
      const guardada = respuestas.get(claveDe(solicitud));
      if (guardada !== undefined) {
        if (guardada.hash !== solicitud.hash) throw new Error('IDEMPOTENCY_CONFLICT: hash distinto para la misma clave');
        return { replay: true, status: guardada.respuesta.status, body: guardada.respuesta.body };
      }
      respuestas.set(claveDe(solicitud), { hash: solicitud.hash, respuesta: { status: 0, body: null } });
      return { replay: false };
    },
    async confirm(solicitud, status, body, cliente) {
      const guardada = respuestas.get(claveDe(solicitud));
      if (guardada === undefined) throw new Error('IDEMPOTENCY_NOT_RESERVED');
      guardada.respuesta = { status, body };
      await cliente.query(
        `UPDATE solicitudes_idempotentes SET response_status = $1, response_body = $2
         WHERE usuario_id = $3 AND operacion = $4 AND clave = $5`,
        [status, JSON.stringify(body), solicitud.actorId, solicitud.operacion, solicitud.clave],
      );
    },
  };
}
