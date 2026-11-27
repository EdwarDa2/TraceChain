/**
 * Orquestación de bloqueos manuales de I-2 (DOC-07).
 * Fuentes: RN-87..96/118, RF-31/32, TP-17, PI-08, API_CONTRACT.md §2/§6/§8.
 * Lógica pura con puertos inyectados: I-1 aporta IncidentReader/BlockWriter y
 * transacción; I-3 aporta verifyDescendant. El bloqueo nunca es automático,
 * nunca modifica stock físico y el cierre de incidencia no libera bloqueos.
 */

export type UUID = string;
export type Instant = string;
export type IncidentStatus = 'ABIERTA' | 'EN_ANALISIS' | 'CERRADA';
export type Verification = 'YES' | 'NO' | 'UNKNOWN';

export interface IncidentRef {
  id: UUID;
  status: IncidentStatus;
}

export interface Block {
  id: UUID;
  lotId: UUID;
  incidentId: UUID;
  reason: string;
  blockedBy: UUID;
  blockedAt: Instant;
  active: boolean;
  releasedBy: UUID | null;
  releasedAt: Instant | null;
  releaseReason: string | null;
}

export interface BlockInput {
  incidentId: UUID;
  originLotId: UUID;
  lotIds: UUID[];
  reason: string;
}

export type BlockErrorCode =
  | 'INCIDENT_CLOSED'
  | 'INVALID_OPERATION'
  | 'LOT_NOT_IN_IMPACT'
  | 'GRAPH_SYNC_PENDING'
  | 'BLOCK_ALREADY_ACTIVE'
  | 'BLOCK_ALREADY_RELEASED'
  | 'RESOURCE_NOT_FOUND';

export type BlockResult =
  | { ok: true; blocks: Block[] }
  | { ok: false; code: BlockErrorCode };

export interface ReleaseResult {
  blockId: UUID;
  active: false;
  lotId: UUID;
  lotBlocked: boolean;
  remainingActiveBlocks: number;
}

export type ReleaseServiceResult =
  | { ok: true; result: ReleaseResult }
  | { ok: false; code: BlockErrorCode };

export interface BlockVerification {
  verifyDescendant(originLotId: UUID, targetLotId: UUID): Promise<Verification>;
}

export interface IncidentSource {
  find(id: UUID): Promise<IncidentRef | null>;
}

export interface BlockStore {
  activeByLotAndIncident(lotId: UUID, incidentId: UUID): Promise<Block | null>;
  createMany(blocks: Block[]): Promise<boolean>; // todo o nada
  findById(id: UUID): Promise<Block | null>;
  release(block: Block): Promise<boolean>;
  countActiveByLot(lotId: UUID): Promise<number>;
}

const MAX_LOTES = 100;

/** Evalúa pertinencia antes de escribir: raíz sin Neo, descendiente verificado, todo o nada. */
export function evaluarPertinencia(
  input: BlockInput,
  incidente: IncidentRef | null,
  verificaciones: Map<UUID, Verification>,
): BlockErrorCode | null {
  if (incidente === null) return 'RESOURCE_NOT_FOUND';
  if (incidente.status === 'CERRADA') return 'INCIDENT_CLOSED';
  if (typeof input.reason !== 'string' || input.reason.trim().length === 0) return 'INVALID_OPERATION';
  if (!Array.isArray(input.lotIds) || input.lotIds.length < 1 || input.lotIds.length > MAX_LOTES ||
      new Set(input.lotIds).size !== input.lotIds.length) return 'INVALID_OPERATION';

  for (const lotId of input.lotIds) {
    if (lotId === input.originLotId) continue; // RN-118: la raíz no requiere Neo
    const resultado = verificaciones.get(lotId);
    if (resultado === 'NO') return 'LOT_NOT_IN_IMPACT';
    if (resultado !== 'YES') return 'GRAPH_SYNC_PENDING';
  }
  return null;
}

export function lotBlocked(bloques: Block[], lotId: UUID): boolean {
  return bloques.some((bloque) => bloque.lotId === lotId && bloque.active);
}

export function activeBlockCount(bloques: Block[], lotId: UUID): number {
  return bloques.filter((bloque) => bloque.lotId === lotId && bloque.active).length;
}

/** Retiro individual: solo analista, con motivo; no toca existencias físicas. */
export function liberarBloque(
  bloque: Block | null,
  motivo: string,
  actorId: UUID,
  now: Instant,
): { ok: true; block: Block } | { ok: false; code: BlockErrorCode } {
  if (bloque === null) return { ok: false, code: 'RESOURCE_NOT_FOUND' };
  if (!bloque.active) return { ok: false, code: 'BLOCK_ALREADY_RELEASED' };
  if (typeof motivo !== 'string' || motivo.trim().length === 0) return { ok: false, code: 'INVALID_OPERATION' };
  return {
    ok: true,
    block: {
      ...bloque,
      active: false,
      releasedBy: actorId,
      releasedAt: now,
      releaseReason: motivo,
    },
  };
}

/** Puertos para generar IDs sin depender de librerías externas en las pruebas. */
export interface BlockIds {
  create(): UUID[];
}

export interface BlockService {
  block(input: BlockInput, actorId: UUID, now: Instant): Promise<BlockResult>;
  release(blockId: UUID, motivo: string, actorId: UUID, now: Instant): Promise<ReleaseServiceResult>;
  remainingActiveBlocks(lotId: UUID): Promise<number>;
}

export function createBlockService(deps: {
  verification: BlockVerification;
  incidents: IncidentSource;
  store: BlockStore;
  ids: BlockIds;
}): BlockService {
  return {
    async block(input, actorId, now) {
      const incidente = await deps.incidents.find(input.incidentId);

      for (const lotId of input.lotIds) {
        if (await deps.store.activeByLotAndIncident(lotId, input.incidentId)) {
          return { ok: false, code: 'BLOCK_ALREADY_ACTIVE' };
        }
      }

      const verificaciones = new Map<UUID, Verification>();
      for (const lotId of new Set(input.lotIds)) {
        if (lotId === input.originLotId) continue;
        verificaciones.set(lotId, await deps.verification.verifyDescendant(input.originLotId, lotId));
      }

      const error = evaluarPertinencia(input, incidente, verificaciones);
      if (error) return { ok: false, code: error };

      const nuevos = deps.ids.create().slice(0, input.lotIds.length).map((id, indice) => ({
        id,
        lotId: input.lotIds[indice]!,
        incidentId: input.incidentId,
        reason: input.reason,
        blockedBy: actorId,
        blockedAt: now,
        active: true,
        releasedBy: null,
        releasedAt: null,
        releaseReason: null,
      }));

      if (!(await deps.store.createMany(nuevos))) return { ok: false, code: 'BLOCK_ALREADY_ACTIVE' };
      return { ok: true, blocks: nuevos };
    },

    async release(blockId, motivo, actorId, now) {
      const actual = await deps.store.findById(blockId);
      const resultado = liberarBloque(actual, motivo, actorId, now);
      if (!resultado.ok) return resultado;
      if (!(await deps.store.release(resultado.block))) return { ok: false, code: 'BLOCK_ALREADY_RELEASED' };
      const restantes = await deps.store.countActiveByLot(resultado.block.lotId);
      return {
        ok: true,
        result: {
          blockId: resultado.block.id,
          active: false,
          lotId: resultado.block.lotId,
          lotBlocked: restantes > 0,
          remainingActiveBlocks: restantes,
        },
      };
    },

    async remainingActiveBlocks(lotId) {
      return deps.store.countActiveByLot(lotId);
    },
  };
}
