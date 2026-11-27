/** DTO y tipos de lectura integrada de `API_CONTRACT.md` §2 y §4. */

import type {
  AnalysisStatus, Count, DataType, DecimalString, EvidenceType, FindingType,
  IncidentStatus, IncidentType, InspectionResult, Instant, LocationType, MovementType,
  NodeType, OriginType, ProductType, Quantity, Role, Severity, SyncStatus, UUID, Unit,
  WarningCode, EdgeType,
} from './common.ts';

export type User = { id: UUID; name: string; email: string; role: Role };
export type Login = { email: string; password: string };
export type LoginResult = { accessToken: string; tokenType: 'Bearer'; expiresIn: number; user: User };
export type Base = { id: UUID; code: string };
export type Audit = { createdAt: Instant; updatedAt: Instant };

export type SupplierCreate = {
  code: string; name: string; contactName?: string | null; email?: string | null;
  phone?: string | null; address?: string | null;
};
export type Supplier = Base & Audit & {
  name: string; contactName: string | null; email: string | null;
  phone: string | null; address: string | null; active: boolean;
};
export type SupplierPatch = Partial<Omit<SupplierCreate, 'code'>>;

export type ProductCreate = { code: string; name: string; description?: string | null; type: ProductType; unit: Unit };
export type Product = Base & Audit & {
  name: string; description: string | null; type: ProductType; unit: Unit; active: boolean;
};
export type ProductPatch = Partial<Omit<ProductCreate, 'code'>>;

export type LocationCreate = { code: string; name: string; type: LocationType; address?: string | null };
export type Location = Base & Audit & {
  name: string; type: LocationType; address: string | null; active: boolean;
};
export type LocationPatch = Partial<Omit<LocationCreate, 'code'>>;
export type StatusPatch = { active: boolean };

export type ReceiptCreate = {
  code: string; productId: UUID; supplierId: UUID; supplierLotCode?: string | null;
  locationId: UUID; quantity: Quantity; receivedAt: Instant; expirationDate?: string | null;
};
export type Lot = Base & {
  productId: UUID; productName: string; productType: ProductType; supplierId: UUID | null;
  supplierLotCode: string | null; originType: OriginType; initialQuantity: Quantity;
  originAt: Instant; expirationDate: string | null; unit: Unit; registeredBy: UUID;
  createdAt: Instant; physicalQuantity: Quantity; usableQuantity: Quantity;
  blocked: boolean; expired: boolean; exhausted: boolean; graphSyncStatus: SyncStatus;
};
export type ReceiptResult = Pick<Lot, 'id' | 'code' | 'initialQuantity' | 'unit' | 'originType' | 'graphSyncStatus'>;

export type Stock = {
  lotId: UUID; lotCode: string; productId: UUID; productName: string;
  locationId: UUID; locationName: string; physicalQuantity: Quantity;
  usableQuantity: Quantity; unit: Unit; blocked: boolean; expired: boolean; updatedAt: Instant;
};
export type Movement = {
  id: UUID; lotId: UUID; locationId: UUID; type: MovementType; direction: 'ENTRADA' | 'SALIDA';
  quantity: Quantity; beforeQuantity: Quantity; afterQuantity: Quantity; unit: Unit;
  productionOrderId: UUID | null; distributionId: UUID | null; actorId: UUID;
  movementAt: Instant; createdAt: Instant;
};
export type LotQuantity = { lotId: UUID; quantity: Quantity };
export type OutputCreate = { code: string; productId: UUID; quantity: Quantity; expirationDate?: string | null };
export type ProductionCreate = {
  name: string; locationId: UUID; producedAt: Instant; notes?: string | null;
  inputs: LotQuantity[]; outputs: OutputCreate[];
};
export type ProductionSummary = Base & {
  name: string; locationId: UUID; producedAt: Instant; inputCount: Count;
  outputCount: Count; graphSyncStatus: SyncStatus;
};
export type ProductionInput = LotQuantity & { id: UUID; lotCode: string; unit: Unit };
export type ProductionOutput = ProductionInput & { productId: UUID; expirationDate: string | null };
export type Production = ProductionSummary & {
  notes: string | null; actorId: UUID; createdAt: Instant;
  inputs: ProductionInput[]; outputs: ProductionOutput[];
};
export type DistributionCreate = {
  originLocationId: UUID; destinationLocationId: UUID; distributedAt: Instant;
  notes?: string | null; items: LotQuantity[];
};
export type DistributionSummary = Base & {
  originLocationId: UUID; destinationLocationId: UUID; distributedAt: Instant;
  itemCount: Count; graphSyncStatus: SyncStatus;
};
export type Distribution = DistributionSummary & {
  actorId: UUID; notes: string | null; createdAt: Instant; items: ProductionInput[];
};

export type TemplateParameter = {
  key: string; label: string; dataType: DataType; unit: string | null; required: boolean;
  options: string[]; min: DecimalString | null; max: DecimalString | null;
};
export type Template = Base & {
  name: string; description: string | null; productId: UUID | null; version: number;
  parameters: TemplateParameter[]; active: boolean; createdAt: Instant;
};
export type Finding = { type: FindingType; parameter: string | null; description: string; severity: Severity };
export type EvidenceCreate = { type: EvidenceType; reference: string; description?: string | null };
export type Evidence = { type: EvidenceType; reference: string; description: string | null; registeredAt: Instant };
export type Parameters = Record<string, string | number | boolean>;
export type InspectionCreate = {
  lotId: UUID; templateId: UUID; templateVersion: number; inspectedAt: Instant;
  parameters: Parameters; result: InspectionResult; findings: Finding[];
  notes?: string | null; evidence: EvidenceCreate[];
};
export type Inspection = Base & {
  lotId: UUID; productId: UUID; templateId: UUID; templateVersion: number;
  inspectorId: UUID; inspectedAt: Instant; parameters: Parameters; result: InspectionResult;
  findings: Finding[]; notes: string | null; evidence: Evidence[]; createdAt: Instant;
};
export type InspectionCreated = Pick<Inspection, 'id' | 'code' | 'lotId' | 'result' | 'createdAt'> & {
  findingsCount: Count;
};
export type QualityCount = {
  total: Count; conforming: Count; nonConforming: Count; nonConformingPercentage: number | null;
};
export type QualitySummary = QualityCount & {
  byProduct: (QualityCount & { productId: UUID; productName: string })[];
};
export type FindingCount = { key: FindingType | Severity; count: Count };

export type IncidentCreate = {
  originLotId: UUID; title: string; type: IncidentType; severity: Severity;
  detectedAt: Instant; description: string; inspectionIds: UUID[];
  findings: Finding[]; evidence: EvidenceCreate[]; notes?: string | null;
};
export type Incident = Base & Audit & {
  originLotId: UUID; title: string; type: IncidentType; severity: Severity;
  status: IncidentStatus; dossierStatus: SyncStatus; reportedBy: UUID;
  detectedAt: Instant; closedAt: Instant | null; closedBy: UUID | null; resolution: string | null;
};
export type IncidentCreated = Pick<Incident, 'id' | 'code' | 'status' | 'dossierStatus'>;
export type Dossier = {
  id: UUID; incidentId: UUID; description: string; inspectionIds: UUID[];
  findings: Finding[]; evidence: Evidence[]; notes: string | null;
  detailedResolution: string | null; version: number; createdAt: Instant; updatedAt: Instant;
};
export type DossierPatch = {
  expectedVersion: number; description?: string; inspectionIds?: UUID[]; findings?: Finding[];
  evidence?: EvidenceCreate[]; notes?: string | null; detailedResolution?: string | null;
};
export type DossierAccepted = {
  incidentId: UUID; currentVersion: number; expectedVersion: number; dossierStatus: 'PENDIENTE';
};
export type CloseIncident = { resolution: string };
export type BlockCreate = { lotIds: UUID[]; reason: string };
export type Block = {
  id: UUID; lotId: UUID; incidentId: UUID; reason: string; blockedBy: UUID;
  blockedAt: Instant; active: boolean; releasedBy: UUID | null;
  releasedAt: Instant | null; releaseReason: string | null;
};
export type ReleaseBlock = { reason: string };
export type ReleaseResult = {
  blockId: UUID; active: false; lotId: UUID; lotBlocked: boolean; remainingActiveBlocks: Count;
};

export type Warning = { code: WarningCode; message: string };
export type SourceStatus = {
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  sync: 'SYNCHRONIZED' | 'PENDING' | 'ERROR' | 'NOT_APPLICABLE';
  checkedAt: Instant; pendingEvents: Count | null;
};
export type Sources = { postgresql: SourceStatus; mongodb: SourceStatus | null; neo4j: SourceStatus | null };
export type Section<T> = { status: AnalysisStatus; data: T | null; warnings: Warning[] };
export type DossierView = {
  dossierStatus: SyncStatus; status: AnalysisStatus; dossier: Dossier | null;
  inspections: Inspection[] | null; warnings: Warning[];
};
export type IncidentDetail = Incident & { dossier: DossierView; blocks: Block[]; sourceStatus: Sources };

export type CommonOriginsRequest = { lotIds: UUID[]; maxDepth?: number };
export type PathsRequest = {
  sourceLotId: UUID; targetLotId: UUID; mode: 'SHORTEST' | 'ALL';
  maxDepth?: number; maxPaths?: number;
};
export type GraphNode = { id: string; entityId: UUID; type: NodeType; label: string; name: string; depth: number | null };
export type GraphEdge = {
  id: string; source: string; target: string; type: EdgeType;
  quantity: Quantity | null; unit: Unit | null;
};
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };
export type TraceLot = {
  lotId: UUID; code: string; productId: UUID; productName: string; productType: ProductType;
  depth: number; direction: 'FORWARD' | 'BACKWARD' | 'BOTH' | 'COMMON' | 'PATH';
  depthByRoot: Record<UUID, number> | null;
};
export type TracePath = { nodeIds: string[]; edgeIds: string[]; depth: number };
export type Destination = {
  distributionId: UUID; distributionCode: string; lotId: UUID; locationId: UUID;
  locationName: string; distributedAt: Instant; transferredQuantity: Quantity; unit: Unit;
};
export type TraceSupplier = { supplierId: UUID; code: string; name: string; lotId: UUID };
export type TraceProcess = { processId: UUID; code: string; name: string; producedAt: Instant };
export type AnalysisMeta = {
  maxDepth: number; analysisTruncated: boolean; visualizationTruncated: boolean;
  graphSynchronized: boolean | null; warnings: Warning[]; durationMs: number;
  analyzedAt: Instant; sourceStatus: Sources;
};
export type TraceSummary = {
  directLots: Count | null; indirectLots: Count | null; totalDescendants: Count | null;
  totalAncestors: Count | null; totalCommonLots: Count | null; pathsReturned: Count | null;
  minPathDepth: number | null; uniqueLots: Count;
};
export type TraceResult = {
  status: AnalysisStatus;
  queryType: 'FORWARD' | 'BACKWARD' | 'GENEALOGY' | 'COMMON_ORIGINS' | 'PATHS';
  rootLotIds: UUID[]; summary: TraceSummary; lots: TraceLot[]; paths: TracePath[];
  destinations: Destination[]; suppliers: TraceSupplier[]; processes: TraceProcess[];
  graph: Graph; metadata: AnalysisMeta;
};
export type ImpactLot = {
  lotId: UUID; code: string; productId: UUID; productName: string;
  classification: 'ORIGEN' | 'DIRECTO' | 'INDIRECTO'; depth: number; unit: Unit;
  physicalQuantity: Quantity; usableQuantity: Quantity; blocked: boolean;
};
export type LotQuality = {
  lotId: UUID; totalInspections: Count; conforming: Count;
  nonConforming: Count; latestInspectionId: UUID | null;
};
export type ImpactQuality = { dossier: DossierView; byLot: LotQuality[] };
export type ImpactSummary = {
  originLots: 1; directLots: Count; indirectLots: Count; totalAffectedLots: Count;
  destinationCount: Count; blockedLots: Count;
};
export type ImpactResult = {
  status: AnalysisStatus; queryType: 'IMPACT'; incident: Incident; originLot: Lot;
  summary: ImpactSummary; affectedLots: ImpactLot[]; stockByLocation: Section<Stock[]>;
  destinations: Section<Destination[]>; quality: Section<ImpactQuality>;
  blocks: Section<Block[]>; graph: Graph; metadata: AnalysisMeta;
};
export type LotDetails = {
  lot: Lot; supplier: Supplier | null; stocks: Section<Stock[]>; quality: Section<LotQuality>;
  genealogy: Section<TraceResult>; incidents: Incident[]; activeBlocks: Block[];
  sourceStatus: Sources; status: AnalysisStatus; warnings: Warning[];
};
export type DashboardSummary = {
  totalLots: Count; totalProductions: Count; activeIncidents: Count; blockedLots: Count;
};
export type Activity = {
  type: 'RECEPCION' | 'PRODUCCION' | 'DISTRIBUCION' | 'INCIDENCIA';
  entityId: UUID; code: string; occurredAt: Instant; description: string;
};
export type SyncMotor = {
  destination: 'NEO4J' | 'MONGODB'; pending: Count; processing: Count; failed: Count;
  completed: Count; lastProcessedAt: Instant | null; lastCompletedSequence: string | null;
  headSequence: string | null; status: SyncStatus;
};
export type SystemStatus = { status: 'AVAILABLE' | 'DEGRADED'; sources: Sources; sync: SyncMotor[] };
export type Health = { status: 'ok' | 'degraded' | 'unavailable' };
