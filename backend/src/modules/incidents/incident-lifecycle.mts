/**
 * Flujo funcional de incidencias de I-2 (DOC-06).
 * Fuentes: API_CONTRACT.md §2/§3, RN-59..68/117, RF-20..23, PM-19..22.
 * Lógica pura y determinista: el bloqueo de filas, la idempotencia HTTP y el
 * evento de outbox los aportan I-1 y la capa de integración (AI-10).
 */

export type UUID = string;
export type Instant = string;
export type IncidentType = 'CALIDAD' | 'EMPAQUE' | 'ALMACENAMIENTO' | 'OTRO';
export type Severity = 'BAJA' | 'MEDIA' | 'ALTA';
export type IncidentStatus = 'ABIERTA' | 'EN_ANALISIS' | 'CERRADA';
export type SyncStatus = 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR';

export interface Incident {
  id: UUID;
  code: string;
  originLotId: UUID;
  title: string;
  type: IncidentType;
  severity: Severity;
  status: IncidentStatus;
  dossierStatus: SyncStatus;
  reportedBy: UUID;
  detectedAt: Instant;
  createdAt: Instant;
  updatedAt: Instant;
  closedAt: Instant | null;
  closedBy: UUID | null;
  resolution: string | null;
}

export interface IncidentCreate {
  originLotId: UUID;
  title: string;
  type: IncidentType;
  severity: Severity;
  detectedAt: Instant;
}

export interface IncidentIds {
  id: UUID;
  code: string;
}

export type IncidentErrorCode =
  | 'INVALID_INCIDENT_TRANSITION'
  | 'DOSSIER_PENDING'
  | 'INCIDENT_CLOSED'
  | 'EMPTY_RESOLUTION';

export type IncidentResult =
  | { ok: true; incident: Incident }
  | { ok: false; code: IncidentErrorCode };

/** RF-20: exactamente un lote origen; sin inspección previa es válido en MVP. */
export function createIncident(
  entrada: IncidentCreate,
  ids: IncidentIds,
  actorId: UUID,
  now: Instant,
): Incident {
  return {
    ...ids,
    originLotId: entrada.originLotId,
    title: entrada.title,
    type: entrada.type,
    severity: entrada.severity,
    status: 'ABIERTA',
    dossierStatus: 'PENDIENTE',
    reportedBy: actorId,
    detectedAt: entrada.detectedAt,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    closedBy: null,
    resolution: null,
  };
}

/** RN-117: única transición permitida ABIERTA → EN_ANALISIS → CERRADA. */
export function startAnalysis(incidente: Incident, now: Instant): IncidentResult {
  if (incidente.status === 'CERRADA') return { ok: false, code: 'INCIDENT_CLOSED' };
  if (incidente.status !== 'ABIERTA') return { ok: false, code: 'INVALID_INCIDENT_TRANSITION' };
  return {
    ok: true,
    incident: { ...incidente, status: 'EN_ANALISIS', updatedAt: now },
  };
}

/**
 * Cierre: exige EN_ANALISIS, resolución no vacía y expediente SINCRONIZADO.
 * No genera evento Mongo (RN-117) y no libera bloqueos (RN-96): el caller
 * responsable de persistir no debe encolar cierre ni tocar bloqueos.
 */
export function closeIncident(
  incidente: Incident,
  resolution: string,
  actorId: UUID,
  now: Instant,
): IncidentResult {
  if (incidente.status === 'CERRADA') return { ok: false, code: 'INCIDENT_CLOSED' };
  if (incidente.status !== 'EN_ANALISIS') return { ok: false, code: 'INVALID_INCIDENT_TRANSITION' };
  if (incidente.dossierStatus !== 'SINCRONIZADO') return { ok: false, code: 'DOSSIER_PENDING' };
  if (typeof resolution !== 'string' || resolution.trim().length === 0) {
    return { ok: false, code: 'EMPTY_RESOLUTION' };
  }
  return {
    ok: true,
    incident: {
      ...incidente,
      status: 'CERRADA',
      closedAt: now,
      closedBy: actorId,
      resolution,
      updatedAt: now,
    },
  };
}

/** PM-20: un expediente de incidencia cerrada no es editable. */
export function puedeEditarExpediente(incidente: Incident): boolean {
  return incidente.status !== 'CERRADA';
}

/** Adaptador de estado documental recibido del handler Mongo/outbox. */
export function conEstadoExpediente(incidente: Incident, estado: SyncStatus, now: Instant): Incident {
  return incidente.dossierStatus === estado
    ? incidente
    : { ...incidente, dossierStatus: estado, updatedAt: now };
}
