/**
 * Repositorios SQL de incidencias y bloqueos de I-1 (REL-03).
 * Fuentes: API_CONTRACT.md §2/§8, DATA_MODEL.md §2, RN-63/64/92/116/117.
 * Todo método de mutación recibe la transacción compartida (Tx); el repositorio
 * devuelve entidades o null y el servicio decide 404. I-2 orquesta los casos de uso.
 */

import type { Tx } from './transaction.mts';

type Fila = Record<string, unknown>;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : valor === null || valor === undefined ? '' : String(valor);
}

function anulable(valor: unknown): string | null {
  return valor === null || valor === undefined ? null : String(valor);
}

export interface IncidentCreation {
  id: string;
  code: string;
  originLotId: string;
  title: string;
  type: string;
  severity: string;
  detectedAt: string;
  reportedBy: string;
}

export interface IncidentEntity {
  id: string;
  code: string;
  originLotId: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  dossierStatus: string;
  reportedBy: string;
  detectedAt: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedBy: string | null;
  resolution: string | null;
}

function incidenteDeFila(fila: Fila): IncidentEntity {
  return {
    id: texto(fila.id),
    code: texto(fila.codigo),
    originLotId: texto(fila.lote_origen_id),
    title: texto(fila.titulo),
    type: texto(fila.tipo),
    severity: texto(fila.severidad),
    status: texto(fila.estado),
    dossierStatus: texto(fila.estado_expediente),
    reportedBy: texto(fila.reportado_por),
    detectedAt: texto(fila.fecha_deteccion),
    createdAt: texto(fila.created_at),
    updatedAt: texto(fila.updated_at),
    closedAt: anulable(fila.fecha_cierre),
    closedBy: anulable(fila.cerrado_por),
    resolution: anulable(fila.resolucion),
  };
}

export interface IncidentRepository {
  create(entrada: IncidentCreation, tx: Tx): Promise<IncidentEntity>;
  find(id: string, tx: Tx): Promise<IncidentEntity | null>;
  lock(id: string, tx: Tx): Promise<IncidentEntity | null>;
  confirmedDossierVersion(id: string, tx: Tx): Promise<number | null>;
  startAnalysis(id: string, tx: Tx): Promise<IncidentEntity | null>;
  close(id: string, resolution: string, actorId: string, tx: Tx): Promise<IncidentEntity | null>;
  markDossierPending(id: string, tx: Tx): Promise<void>;
}

/** La versión confirmada se deriva de eventos completados, nunca de una columna propia. */
async function versionDesdeEventos(id: string, tx: Tx): Promise<number | null> {
  const resultado = await tx.query(
    `SELECT payload FROM eventos_sincronizacion
     WHERE entidad_id = $1 AND estado = 'COMPLETADO'
       AND tipo_evento IN ('INCIDENCIA_REGISTRADA', 'EXPEDIENTE_ACTUALIZADO')
     ORDER BY secuencia ASC`,
    [id],
  );
  let version: number | null = null;
  for (const fila of resultado.rows) {
    try {
      const envelope = (typeof fila.payload === 'string'
        ? JSON.parse(fila.payload) : fila.payload) as { payload?: Record<string, unknown> };
      const datos = envelope.payload ?? {};
      const candidato = datos.nextVersion ?? datos.version;
      if (typeof candidato === 'number' && Number.isInteger(candidato)) {
        version = version === null ? candidato : Math.max(version, candidato);
      }
    } catch {
      continue;
    }
  }
  return version;
}

export function createIncidentRepository(): IncidentRepository {
  return {
    async create(entrada, tx) {
      const resultado = await tx.query(
        `INSERT INTO incidencias
          (id, codigo, lote_origen_id, titulo, tipo, severidad, estado, estado_expediente,
           reportado_por, fecha_deteccion, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
         RETURNING *`,
        [
          entrada.id, entrada.code, entrada.originLotId, entrada.title, entrada.type,
          entrada.severity, 'ABIERTA', 'PENDIENTE', entrada.reportedBy, entrada.detectedAt,
        ],
      );
      return incidenteDeFila(resultado.rows[0] ?? {});
    },
    async find(id, tx) {
      const resultado = await tx.query('SELECT * FROM incidencias WHERE id = $1', [id]);
      return resultado.rows[0] ? incidenteDeFila(resultado.rows[0]) : null;
    },
    async lock(id, tx) {
      const resultado = await tx.query('SELECT * FROM incidencias WHERE id = $1 FOR UPDATE', [id]);
      return resultado.rows[0] ? incidenteDeFila(resultado.rows[0]) : null;
    },
    confirmedDossierVersion: versionDesdeEventos,
    async startAnalysis(id, tx) {
      const resultado = await tx.query(
        `UPDATE incidencias SET estado = 'EN_ANALISIS', updated_at = now()
         WHERE id = $1 AND estado = 'ABIERTA' RETURNING *`,
        [id],
      );
      return resultado.rows[0] ? incidenteDeFila(resultado.rows[0]) : null;
    },
    async close(id, resolution, actorId, tx) {
      const resultado = await tx.query(
        `UPDATE incidencias
         SET estado = 'CERRADA', resolucion = $2, fecha_cierre = now(), cerrado_por = $3, updated_at = now()
         WHERE id = $1 AND estado = 'EN_ANALISIS' RETURNING *`,
        [id, resolution, actorId],
      );
      return resultado.rows[0] ? incidenteDeFila(resultado.rows[0]) : null;
    },
    async markDossierPending(id, tx) {
      await tx.query(
        "UPDATE incidencias SET estado_expediente = 'PENDIENTE', updated_at = now() WHERE id = $1",
        [id],
      );
    },
  };
}

export interface BlockEntity {
  id: string;
  lotId: string;
  incidentId: string;
  reason: string;
  blockedBy: string;
  blockedAt: string;
  active: boolean;
  releasedBy: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
}

function bloqueoDeFila(fila: Fila): BlockEntity {
  return {
    id: texto(fila.id),
    lotId: texto(fila.lote_id),
    incidentId: texto(fila.incidencia_id),
    reason: texto(fila.motivo),
    blockedBy: texto(fila.bloqueado_por),
    blockedAt: texto(fila.fecha_bloqueo),
    active: fila.activo === true,
    releasedBy: anulable(fila.desbloqueado_por),
    releasedAt: anulable(fila.fecha_desbloqueo),
    releaseReason: anulable(fila.motivo_desbloqueo),
  };
}

export interface BlockRepositorySql {
  activeByLots(lotIds: string[], tx: Tx): Promise<BlockEntity[]>;
  byIncident(incidentId: string, tx: Tx): Promise<BlockEntity[]>;
  createMany(incidentId: string, lotIds: string[], reason: string, actorId: string, tx: Tx): Promise<BlockEntity[]>;
  release(blockId: string, reason: string, actorId: string, tx: Tx): Promise<BlockEntity>;
}

export function createBlockRepository(): BlockRepositorySql {
  return {
    async activeByLots(lotIds, tx) {
      const resultado = await tx.query(
        'SELECT * FROM bloqueos_lotes WHERE lote_id = ANY($1) AND activo = true',
        [lotIds],
      );
      return resultado.rows.map(bloqueoDeFila);
    },
    async byIncident(incidentId, tx) {
      const resultado = await tx.query('SELECT * FROM bloqueos_lotes WHERE incidencia_id = $1', [incidentId]);
      return resultado.rows.map(bloqueoDeFila);
    },
    async createMany(incidentId, lotIds, reason, actorId, tx) {
      const bloqueos: BlockEntity[] = [];
      for (const lotId of new Set(lotIds)) {
        const resultado = await tx.query(
          `INSERT INTO bloqueos_lotes
            (id, lote_id, incidencia_id, motivo, bloqueado_por, fecha_bloqueo, activo)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), true) RETURNING *`,
          [lotId, incidentId, reason, actorId],
        );
        if (resultado.rows[0]) bloqueos.push(bloqueoDeFila(resultado.rows[0]));
      }
      return bloqueos;
    },
    async release(blockId, reason, actorId, tx) {
      const resultado = await tx.query(
        `UPDATE bloqueos_lotes
         SET activo = false, desbloqueado_por = $2, fecha_desbloqueo = now(), motivo_desbloqueo = $3
         WHERE id = $1 AND activo = true RETURNING *`,
        [blockId, actorId, reason],
      );
      if ((resultado.rowCount ?? 0) === 0) throw new Error('BLOCK_ALREADY_RELEASED: bloqueo no activo');
      return bloqueoDeFila(resultado.rows[0] ?? {});
    },
  };
}
