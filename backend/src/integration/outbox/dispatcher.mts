import { setTimeout as delay } from 'node:timers/promises';
import type { Pool, PoolClient } from 'pg';

type Destination = 'NEO4J' | 'MONGODB';
const LOCK_IDS = { NEO4J: 1, MONGODB: 2 };
const ENTITY_TYPES = {
  PROVEEDOR_CREADO: ['SUPPLIER'], PRODUCTO_CREADO: ['PRODUCT'], UBICACION_CREADA: ['LOCATION'],
  CATALOGO_ACTUALIZADO: ['SUPPLIER', 'PRODUCT', 'LOCATION'], LOTE_RECIBIDO: ['LOT'],
  PRODUCCION_REGISTRADA: ['PRODUCTION'], DISTRIBUCION_REGISTRADA: ['DISTRIBUTION'],
  INCIDENCIA_REGISTRADA: ['INCIDENT'], EXPEDIENTE_ACTUALIZADO: ['INCIDENT'],
} as const;

// En el límite SQL el payload aún no es un DTO validado. El adaptador de
// destino valida su variante antes de aplicar el EventHandler correspondiente.
export interface Delivery {
  eventId: string;
  sequence: string;
  eventType: keyof typeof ENTITY_TYPES;
  entityType: string;
  entityId: string;
  destination: Destination;
  occurredAt: string;
  payloadVersion: 1;
  payload: Record<string, unknown>;
}
type Apply = (event: Delivery, signal: AbortSignal) => Promise<void>;
export class PermanentDeliveryError extends Error {}

interface Row {
  id: string; secuencia: string; tipo_evento: string; tipo_entidad: string;
  entidad_id: string; motor_destino: Destination; payload: unknown; created_at: Date; intentos: number;
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function envelope(row: Row): Delivery {
  const key = row.tipo_evento;
  if (!Object.hasOwn(ENTITY_TYPES, key)) throw new PermanentDeliveryError();
  const eventType = key as keyof typeof ENTITY_TYPES;
  const entities: readonly string[] = ENTITY_TYPES[eventType];
  if (!entities.includes(row.tipo_entidad) ||
      (row.tipo_entidad === 'INCIDENT') !== (row.motor_destino === 'MONGODB') ||
      !object(row.payload) || row.payload.payloadVersion !== 1 || !object(row.payload.payload)) {
    throw new PermanentDeliveryError();
  }
  return { eventId: row.id, sequence: row.secuencia, eventType, entityType: row.tipo_entidad,
    entityId: row.entidad_id, destination: row.motor_destino, occurredAt: row.created_at.toISOString(),
    payloadVersion: 1, payload: row.payload.payload };
}

// Una sola sentencia/tx corta: aplicar la elegibilidad DESPUÉS de elegir la cabeza.
// Un PROCESANDO residual se puede retomar porque poseemos el lock de sesión.
const CLAIM = `WITH cabeza AS (
  SELECT id FROM eventos_sincronizacion
  WHERE motor_destino=$1 AND estado <> 'COMPLETADO' ORDER BY secuencia LIMIT 1
) UPDATE eventos_sincronizacion e SET estado='PROCESANDO', intentos=intentos+1,
  procesando_desde=now(), proximo_intento_at=NULL FROM cabeza
  WHERE e.id=cabeza.id AND (estado IN ('PENDIENTE','PROCESANDO') OR proximo_intento_at <= now())
  RETURNING e.*`;

async function finish(client: PoolClient, row: Row, failure: 'TRANSITORIO' | 'PERMANENTE' | null, maxDelay: number) {
  await client.query('BEGIN');
  try {
    const mongo = row.motor_destino === 'MONGODB' && row.tipo_entidad === 'INCIDENT';
    if (mongo) await client.query('SELECT id FROM incidencias WHERE id=$1 FOR UPDATE', [row.entidad_id]);
    const retry = failure === 'TRANSITORIO' ? Math.min(maxDelay, 5000 * 2 ** Math.min(20, row.intentos - 1)) : null;
    await client.query(`UPDATE eventos_sincronizacion SET estado=$2::varchar, ultimo_error=$3,
      procesando_desde=NULL, proximo_intento_at=now()+$4::double precision * interval '1 millisecond',
      processed_at=CASE WHEN $2='COMPLETADO' THEN now() END WHERE id=$1`,
    [row.id, failure ? 'FALLIDO' : 'COMPLETADO', failure, retry]);
    if (mongo) {
      const result = await client.query(`UPDATE incidencias SET estado_expediente=CASE WHEN $2::boolean THEN 'ERROR'
        WHEN EXISTS (SELECT 1 FROM eventos_sincronizacion WHERE entidad_id=$1 AND motor_destino='MONGODB'
          AND estado <> 'COMPLETADO') THEN 'PENDIENTE' ELSE 'SINCRONIZADO' END WHERE id=$1`,
      [row.entidad_id, failure !== null]);
      if (!result.rowCount && !failure) throw new Error('INCIDENCIA_AUSENTE');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function dispatchNext(pool: Pool, destination: Destination, apply: Apply, maxDelay = 300_000) {
  const client = await pool.connect();
  let locked = false;
  let broken = false;
  const lost = new AbortController();
  const onError = () => { broken = true; lost.abort(); };
  client.on('error', onError);
  try {
    const lock = [82701, LOCK_IDS[destination]];
    locked = (await client.query('SELECT pg_try_advisory_lock($1,$2) AS ok', lock)).rows[0].ok;
    if (!locked) return 'idle';
    const row = (await client.query<Row>(CLAIM, [destination])).rows[0];
    if (!row) return 'idle';
    const signal = AbortSignal.any([lost.signal, AbortSignal.timeout(30_000)]);
    let failure: 'TRANSITORIO' | 'PERMANENTE' | null = null;
    try {
      // No Promise.race: el adaptador debe cancelar su operación y liquidar
      // su promesa antes de que podamos liberar el lock o volver a entregar.
      await apply(envelope(row), signal);
      signal.throwIfAborted();
    } catch (error) {
      failure = error instanceof PermanentDeliveryError ? 'PERMANENTE' : 'TRANSITORIO';
    }
    if (broken) throw new Error('CONEXION_OUTBOX_PERDIDA');
    await finish(client, row, failure, maxDelay);
    return failure ? 'failed' : 'applied';
  } catch (error) {
    broken = true;
    throw error;
  } finally {
    try {
      if (locked && !broken) await client.query('SELECT pg_advisory_unlock($1,$2)', [82701, LOCK_IDS[destination]]);
    } catch {
      broken = true;
    } finally {
      client.off('error', onError);
      client.release(broken);
    }
  }
}

/** Un bucle por destino registrado; abortar detiene el sondeo después de la entrega en curso. */
export async function runOutbox(pool: Pool, destination: Destination, apply: Apply, options: {
  signal: AbortSignal; pollMs?: number; maxRetryDelayMs?: number; onDatabaseError: () => void;
}) {
  while (!options.signal.aborted) {
    try {
      if (await dispatchNext(pool, destination, apply, options.maxRetryDelayMs) === 'applied') continue;
    } catch {
      options.onDatabaseError();
    }
    try {
      await delay(options.pollMs ?? 2000, undefined, { signal: options.signal });
    } catch (error) {
      if (!options.signal.aborted) throw error;
    }
  }
}
