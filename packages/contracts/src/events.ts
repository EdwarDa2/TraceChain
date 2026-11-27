/** Eventos internos v1 de `API_CONTRACT.md` §7. Sin drivers ni credenciales. */

import type {
  EntityType, EventDestination, EventType, Instant, LocationType, ProductType,
  Quantity, UUID, Unit,
} from './common.ts';
import type { Evidence, Finding } from './dto.ts';

export type SupplierProjection = { id: UUID; code: string; name: string; active: boolean };
export type ProductProjection = SupplierProjection & { type: ProductType; unit: Unit };
export type LocationProjection = SupplierProjection & { type: LocationType };
export type LotProjection = { id: UUID; code: string; productId: UUID; originType: string; originAt: Instant };
export type ProcessProjection = {
  id: UUID; code: string; name: string; locationId: UUID; producedAt: Instant;
};
export type RelationQuantity = { id: UUID; lotId: UUID; quantity: Quantity; unit: Unit };
export type DossierFields = {
  description: string; inspectionIds: UUID[]; findings: Finding[]; evidence: Evidence[];
  notes: string | null; detailedResolution: string | null;
};

export type EventPayloadMap = {
  PROVEEDOR_CREADO: { supplier: SupplierProjection };
  PRODUCTO_CREADO: { product: ProductProjection };
  UBICACION_CREADA: { location: LocationProjection };
  CATALOGO_ACTUALIZADO:
    | { entityType: 'SUPPLIER'; supplier: SupplierProjection }
    | { entityType: 'PRODUCT'; product: ProductProjection }
    | { entityType: 'LOCATION'; location: LocationProjection };
  LOTE_RECIBIDO: { lot: LotProjection; supplierId: UUID };
  PRODUCCION_REGISTRADA: {
    process: ProcessProjection; inputs: RelationQuantity[];
    outputs: { id: UUID; lot: LotProjection; quantity: Quantity; unit: Unit }[];
  };
  DISTRIBUCION_REGISTRADA: {
    distribution: {
      id: UUID; code: string; distributedAt: Instant;
      originLocationId: UUID; destinationLocationId: UUID;
    };
    items: RelationQuantity[];
  };
  INCIDENCIA_REGISTRADA: {
    incidentId: UUID; dossierId: UUID; version: 1; fields: DossierFields;
  };
  EXPEDIENTE_ACTUALIZADO: {
    incidentId: UUID; expectedVersion: number; nextVersion: number; changes: Partial<DossierFields>;
  };
};

export type EventEnvelope<K extends EventType = EventType> = {
  eventId: UUID;
  sequence: string;
  eventType: K;
  entityType: EntityType;
  entityId: UUID;
  destination: EventDestination;
  payloadVersion: 1;
  occurredAt: Instant;
  payload: EventPayloadMap[K];
};

export interface EventHandler<K extends EventType = EventType> {
  apply(event: EventEnvelope<K>): Promise<void>;
}
