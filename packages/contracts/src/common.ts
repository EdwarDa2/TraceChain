/** Alias, enums oficiales y catálogos de `API_CONTRACT.md` §1/§6. */

export type UUID = string;
export type Instant = string;
export type CivilDate = string;
export type Quantity = string;
export type DecimalString = string;
export type Count = number;

export const ROLES = ['OPERADOR', 'ANALISTA_CALIDAD'] as const;
export type Role = (typeof ROLES)[number];

export const PRODUCT_TYPES = ['MATERIA_PRIMA', 'INTERMEDIO', 'TERMINADO'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const UNITS = ['KG', 'G', 'L', 'ML', 'UNIDAD'] as const;
export type Unit = (typeof UNITS)[number];

export const LOCATION_TYPES = ['ALMACEN', 'PLANTA_PRODUCCION', 'SUCURSAL'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const ORIGIN_TYPES = ['RECEPCION', 'PRODUCCION'] as const;
export type OriginType = (typeof ORIGIN_TYPES)[number];

export const SEVERITIES = ['BAJA', 'MEDIA', 'ALTA'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const INCIDENT_TYPES = ['CALIDAD', 'EMPAQUE', 'ALMACENAMIENTO', 'OTRO'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_STATUSES = ['ABIERTA', 'EN_ANALISIS', 'CERRADA'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const SYNC_STATUSES = ['PENDIENTE', 'SINCRONIZADO', 'ERROR'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const INSPECTION_RESULTS = ['CONFORME', 'NO_CONFORME'] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export const DATA_TYPES = ['TEXTO', 'ENTERO', 'DECIMAL', 'BOOLEANO', 'SELECCION'] as const;
export type DataType = (typeof DATA_TYPES)[number];

export const FINDING_TYPES = [
  'IMPUREZAS', 'HUMEDAD', 'PESO', 'EMPAQUE', 'APARIENCIA', 'TEXTURA', 'TEMPERATURA', 'OTRO',
] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const EVIDENCE_TYPES = ['IMAGEN', 'DOCUMENTO', 'REFERENCIA'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const MOVEMENT_TYPES = [
  'RECEPCION', 'CONSUMO_PRODUCCION', 'RESULTADO_PRODUCCION', 'DISTRIBUCION_SALIDA', 'DISTRIBUCION_ENTRADA',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const NODE_TYPES = ['Proveedor', 'Producto', 'Lote', 'Proceso', 'Distribucion', 'Ubicacion'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_TYPES = [
  'SUMINISTRA', 'CORRESPONDE_A', 'UTILIZADO_EN', 'GENERA', 'INCLUIDO_EN', 'SALE_DE', 'ENTREGADO_A',
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export const ANALYSIS_STATUSES = ['COMPLETO', 'PARCIAL', 'NO_DISPONIBLE'] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const WARNING_CODES = [
  'DEPTH_LIMIT', 'RESULT_LIMIT', 'PATH_LIMIT', 'GRAPH_PENDING', 'DOCUMENT_PENDING',
  'QUALITY_UNAVAILABLE', 'GRAPH_UNAVAILABLE', 'TIME_LIMIT', 'CONCURRENT_CHANGES', 'DETAIL_LIMIT',
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export const ERROR_CODES = [
  'VALIDATION_ERROR', 'IDEMPOTENCY_KEY_REQUIRED', 'INVALID_CREDENTIALS', 'UNAUTHORIZED',
  'TOKEN_EXPIRED', 'FORBIDDEN', 'RESOURCE_NOT_FOUND', 'DUPLICATE_CODE', 'INSUFFICIENT_STOCK',
  'LOT_BLOCKED', 'LOT_EXPIRED', 'INACTIVE_RESOURCE', 'LOCATION_HAS_STOCK', 'IMMUTABLE_FIELD',
  'IDEMPOTENCY_CONFLICT', 'DOSSIER_PENDING', 'VERSION_CONFLICT', 'INVALID_INCIDENT_TRANSITION',
  'INCIDENT_CLOSED', 'BLOCK_ALREADY_ACTIVE', 'BLOCK_ALREADY_RELEASED', 'INVALID_QUANTITY',
  'INVALID_TEMPLATE', 'INVALID_INSPECTION_PARAMETERS', 'INVALID_OPERATION_DATE',
  'LOT_NOT_IN_IMPACT', 'INVALID_REFERENCE', 'INVALID_OPERATION', 'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED', 'INTERNAL_ERROR', 'GRAPH_SYNC_PENDING', 'GRAPH_INCONSISTENT',
  'TEMPLATE_UNAVAILABLE', 'DATABASE_UNAVAILABLE', 'QUERY_TIMEOUT',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const EVENT_TYPES = [
  'PROVEEDOR_CREADO', 'PRODUCTO_CREADO', 'UBICACION_CREADA', 'CATALOGO_ACTUALIZADO',
  'LOTE_RECIBIDO', 'PRODUCCION_REGISTRADA', 'DISTRIBUCION_REGISTRADA',
  'INCIDENCIA_REGISTRADA', 'EXPEDIENTE_ACTUALIZADO',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_DESTINATIONS = ['NEO4J', 'MONGODB'] as const;
export type EventDestination = (typeof EVENT_DESTINATIONS)[number];

export const ENTITY_TYPES = [
  'SUPPLIER', 'PRODUCT', 'LOCATION', 'LOT', 'PRODUCTION', 'DISTRIBUTION', 'INCIDENT',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
