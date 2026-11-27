/** Interfaces de coordinación de `API_CONTRACT.md` §8. */

import type { DecimalString, EventType, MovementType, UUID } from './common.ts';
import type {
  Block, DossierView, Incident, Inspection, Lot, LotQuality, Product, ReleaseResult,
  Stock, TraceResult, User, CommonOriginsRequest, PathsRequest,
} from './dto.ts';
import type { EventEnvelope } from './events.ts';

declare const TxBrand: unique symbol;
/** Contexto opaco transaccional: encapsula PoolClient en backend, nunca se exporta al frontend. */
export interface Tx {
  readonly [TxBrand]: true;
}
export type ReadOptions = { tx?: Tx };
export type Actor = User;

export interface TransactionManager {
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

export interface LotReader {
  find(id: UUID, opts?: ReadOptions): Promise<Lot | null>;
  findMany(ids: UUID[], opts?: ReadOptions): Promise<Lot[]>;
}
export interface ProductReader {
  find(id: UUID, opts?: ReadOptions): Promise<Product | null>;
  findMany(ids: UUID[], opts?: ReadOptions): Promise<Product[]>;
}
export interface InventoryReader {
  byLots(ids: UUID[], opts?: ReadOptions): Promise<Stock[]>;
  byLotLocation(lotId: UUID, locationId: UUID, opts?: ReadOptions): Promise<Stock | null>;
}
export interface InventoryWriter {
  lockLots(ids: UUID[], tx: Tx): Promise<void>;
  changeStock(
    input: {
      lotId: UUID; locationId: UUID; delta: DecimalString; movementType: MovementType;
      productionOrderId: UUID | null; distributionId: UUID | null;
      actorId: UUID; movementAt: string;
    },
    tx: Tx,
  ): Promise<Stock>;
}
export interface BlocksReader {
  activeByLots(ids: UUID[], opts?: ReadOptions): Promise<Block[]>;
  byIncident(id: UUID, opts?: ReadOptions): Promise<Block[]>;
}
export interface IncidentReader {
  find(id: UUID, opts?: ReadOptions): Promise<Incident | null>;
  byOriginLot(id: UUID, opts?: ReadOptions): Promise<Incident[]>;
  confirmedDossierVersion(id: UUID, opts?: ReadOptions): Promise<number | null>;
}
export interface IncidentWriter {
  lock(id: UUID, tx: Tx): Promise<Incident | null>;
  create(
    input: {
      originLotId: UUID; title: string; type: Incident['type']; severity: Incident['severity'];
      detectedAt: string; actorId: UUID;
    },
    tx: Tx,
  ): Promise<Incident>;
  markDossierPending(id: UUID, tx: Tx): Promise<void>;
  startAnalysis(id: UUID, tx: Tx): Promise<Incident>;
  close(id: UUID, input: { resolution: string; actorId: UUID }, tx: Tx): Promise<Incident>;
}
export interface BlockWriter {
  createMany(incidentId: UUID, lotIds: UUID[], reason: string, actorId: UUID, tx: Tx): Promise<Block[]>;
  release(blockId: UUID, reason: string, actorId: UUID, tx: Tx): Promise<ReleaseResult>;
}
export interface QualityReader {
  inspection(id: UUID): Promise<Inspection | null>;
  inspectionsByIds(ids: UUID[]): Promise<Inspection[]>;
  summarizeLots(ids: UUID[]): Promise<LotQuality[]>;
  dossier(incidentId: UUID): Promise<DossierView>;
}
export interface TraceabilityReader {
  forward(lotId: UUID, maxDepth: number): Promise<TraceResult>;
  backward(lotId: UUID, maxDepth: number): Promise<TraceResult>;
  commonOrigins(input: CommonOriginsRequest): Promise<TraceResult>;
  paths(input: PathsRequest): Promise<TraceResult>;
  verifyDescendant(origin: UUID, target: UUID): Promise<'YES' | 'NO' | 'UNKNOWN'>;
}
export interface OutboxWriter {
  enqueue<K extends EventType>(
    event: Omit<EventEnvelope<K>, 'sequence' | 'occurredAt'>,
    tx: Tx,
  ): Promise<void>;
}
