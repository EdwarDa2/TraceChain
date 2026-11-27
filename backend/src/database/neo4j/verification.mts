import type { Driver } from 'neo4j-driver';
import type { Pool } from 'pg';
import { traverseLots } from './traversal.mts';

/**
 * RN-118: un camino positivo en la proyección histórica inmutable basta;
 * ausencia solo es negativa si el recorrido fue completo y la cola Neo
 * no tiene eventos pendientes (criterio conservador global).
 */
export async function verifyDescendant(pool: Pool, driver: Driver, database: string,
  originId: string, targetId: string): Promise<'YES' | 'NO' | 'UNKNOWN'> {
  let before: { sequence: string; pending: boolean } | undefined;
  try {
    const state = await pool.query<{ sequence: string; pending: boolean }>(`SELECT
      COALESCE(MAX(secuencia), 0)::text AS sequence,
      COALESCE(bool_or(estado <> 'COMPLETADO'), false) AS pending
      FROM eventos_sincronizacion WHERE motor_destino='NEO4J'`);
    before = state.rows[0];
  } catch {
    // Un positivo Neo sigue siendo verificable aunque PG no esté disponible.
  }
  try {
    const traversal = await traverseLots(driver, database, originId, 'FORWARD', 20);
    if (traversal.lots.some((lot) => lot.lotId === targetId)) return 'YES';
    if (traversal.status === 'PARCIAL' || !before || before.pending) return 'UNKNOWN';
    const state = await pool.query<{ sequence: string; pending: boolean }>(`SELECT
      COALESCE(MAX(secuencia), 0)::text AS sequence,
      COALESCE(bool_or(estado <> 'COMPLETADO'), false) AS pending
      FROM eventos_sincronizacion WHERE motor_destino='NEO4J'`);
    const after = state.rows[0];
    return after && !after.pending && after.sequence === before.sequence ? 'NO' : 'UNKNOWN';
  } catch {
    // No convertir Neo o SQL caídos ni errores de consulta en un negativo concluyente.
    return 'UNKNOWN';
  }
}
