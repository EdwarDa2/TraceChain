/**
 * Expediente documental y handlers Mongo de I-2 (DOC-05).
 * Fuentes: DATA_MODEL.md §3, API_CONTRACT.md §7/§8, RN-63/RN-116, PM-12..16.
 * Lógica pura: el driver MongoDB se inyecta como puerto; los dobles existen solo
 * en pruebas aisladas (sin mocks en aplicación integrada).
 */

export type UUID = string;
export type Instant = string;
export type FindingType =
  | 'IMPUREZAS' | 'HUMEDAD' | 'PESO' | 'EMPAQUE' | 'APARIENCIA'
  | 'TEXTURA' | 'TEMPERATURA' | 'OTRO';
export type Severity = 'BAJA' | 'MEDIA' | 'ALTA';
export type EvidenceType = 'IMAGEN' | 'DOCUMENTO' | 'REFERENCIA';

export interface Finding {
  type: FindingType;
  parameter: string | null;
  description: string;
  severity: Severity;
}

export interface EvidenceCreate {
  type: EvidenceType;
  reference: string;
  description?: string | null;
}

export interface Evidence {
  type: EvidenceType;
  reference: string;
  description: string | null;
  registeredAt: Instant;
}

export interface DossierFields {
  description: string;
  inspectionIds: UUID[];
  findings: Finding[];
  evidence: Evidence[];
  notes: string | null;
  detailedResolution: string | null;
}

export interface Dossier extends DossierFields {
  id: UUID;
  incidentId: UUID;
  version: number;
  ultimoEventoId: UUID;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface DossierPatch {
  expectedVersion: number;
  description?: string;
  inspectionIds?: UUID[];
  findings?: Finding[];
  evidence?: EvidenceCreate[];
  notes?: string | null;
  detailedResolution?: string | null;
}

export interface DossierAccepted {
  incidentId: UUID;
  currentVersion: number;
  expectedVersion: number;
  dossierStatus: 'PENDIENTE';
}

export type DossierErrorCode =
  | 'VERSION_CONFLICT'
  | 'INVALID_PATCH'
  | 'LIMIT_EXCEEDED'
  | 'DUPLICATE_REFERENCE'
  | 'EVENT_MISMATCH';

export type DossierResult =
  | { ok: true; dossier: Dossier; currentVersion: number; nextVersion: number; replayed: boolean }
  | { ok: false; code: DossierErrorCode };

/** Subconjunto de EventEnvelope v1 (API_CONTRACT §7) que consumen los handlers Mongo. */
export interface IncidenciaRegistradaEvent {
  eventId: UUID;
  eventType: 'INCIDENCIA_REGISTRADA';
  payloadVersion: 1;
  occurredAt: Instant;
  payload: {
    incidentId: UUID;
    dossierId: UUID;
    version: 1;
    fields: DossierFields;
  };
}

export interface ExpedienteActualizadoEvent {
  eventId: UUID;
  eventType: 'EXPEDIENTE_ACTUALIZADO';
  payloadVersion: 1;
  occurredAt: Instant;
  payload: {
    incidentId: UUID;
    expectedVersion: number;
    nextVersion: number;
    changes: Partial<DossierFields>;
  };
}

export type MongoDossierEvent = IncidenciaRegistradaEvent | ExpedienteActualizadoEvent;

const CAMPOS_MUTABLES = ['description', 'inspectionIds', 'findings', 'evidence', 'notes', 'detailedResolution'] as const;
const MAX_INSPECCIONES = 50;
const MAX_HALLAZGOS = 30;
const MAX_EVIDENCIAS = 20;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIPOS_HALLAZGO: FindingType[] = [
  'IMPUREZAS', 'HUMEDAD', 'PESO', 'EMPAQUE', 'APARIENCIA', 'TEXTURA', 'TEMPERATURA', 'OTRO',
];
const SEVERIDADES: Severity[] = ['BAJA', 'MEDIA', 'ALTA'];
const TIPOS_EVIDENCIA: EvidenceType[] = ['IMAGEN', 'DOCUMENTO', 'REFERENCIA'];

function validarCampos(campos: Partial<DossierFields>): DossierErrorCode | null {
  if ('description' in campos && (typeof campos.description !== 'string' ||
      campos.description.length < 1 || campos.description.length > 5000)) return 'INVALID_PATCH';
  if ('notes' in campos && campos.notes !== null &&
      (typeof campos.notes !== 'string' || campos.notes.length > 3000)) return 'INVALID_PATCH';
  if ('detailedResolution' in campos && campos.detailedResolution !== null &&
      (typeof campos.detailedResolution !== 'string' || campos.detailedResolution.length > 5000)) return 'INVALID_PATCH';

  if ('inspectionIds' in campos) {
    const ids = campos.inspectionIds;
    if (!Array.isArray(ids) || ids.length > MAX_INSPECCIONES ||
        ids.some((id) => !UUID_V4.test(id)) || new Set(ids).size !== ids.length) {
      return ids && ids.length > MAX_INSPECCIONES ? 'LIMIT_EXCEEDED' : 'DUPLICATE_REFERENCE';
    }
  }
  if ('findings' in campos) {
    const hallazgos = campos.findings;
    if (!Array.isArray(hallazgos)) return 'INVALID_PATCH';
    if (hallazgos.length > MAX_HALLAZGOS) return 'LIMIT_EXCEEDED';
    for (const hallazgo of hallazgos) {
      if (!TIPOS_HALLAZGO.includes(hallazgo.type) || !SEVERIDADES.includes(hallazgo.severity) ||
          typeof hallazgo.description !== 'string' || hallazgo.description.length < 1 ||
          (hallazgo.parameter !== null && typeof hallazgo.parameter !== 'string')) {
        return 'INVALID_PATCH';
      }
    }
  }
  if ('evidence' in campos) {
    const evidencias = campos.evidence;
    if (!Array.isArray(evidencias)) return 'INVALID_PATCH';
    if (evidencias.length > MAX_EVIDENCIAS) return 'LIMIT_EXCEEDED';
    for (const evidencia of evidencias) {
      if (!TIPOS_EVIDENCIA.includes(evidencia.type) || typeof evidencia.reference !== 'string' ||
          evidencia.reference.length < 1 || evidencia.reference.length > 500) return 'INVALID_PATCH';
    }
  }
  return null;
}

function conFechasDeServidor(evidencias: EvidenceCreate[], now: Instant): Evidence[] {
  return evidencias.map((evidencia) => ({
    type: evidencia.type,
    reference: evidencia.reference,
    description: evidencia.description ?? null,
    registeredAt: now,
  }));
}

/** Creación del expediente desde INCIDENCIA_REGISTRADA (una sola vez). */
export function createDossier(event: IncidenciaRegistradaEvent, now: Instant): Dossier {
  const campos = event.payload.fields;
  return {
    id: event.payload.dossierId,
    incidentId: event.payload.incidentId,
    description: campos.description,
    inspectionIds: [...campos.inspectionIds],
    findings: campos.findings.map((hallazgo) => ({ ...hallazgo, parameter: hallazgo.parameter ?? null })),
    evidence: conFechasDeServidor(campos.evidence as EvidenceCreate[], now),
    notes: campos.notes ?? null,
    detailedResolution: campos.detailedResolution ?? null,
    version: 1,
    ultimoEventoId: event.eventId,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * CAS documental: expectedVersion debe coincidir con la versión leída; el evento
 * se marca en la misma escritura. Un replay por ultimoEventoId no reescribe nada.
 */
export function applyDossierPatch(
  actual: Dossier,
  patch: DossierPatch,
  eventId: UUID,
  now: Instant,
): DossierResult {
  if (actual.ultimoEventoId === eventId) {
    return { ok: true, dossier: actual, currentVersion: actual.version, nextVersion: actual.version, replayed: true };
  }
  if (!Number.isInteger(patch.expectedVersion) || patch.expectedVersion !== actual.version) {
    return { ok: false, code: 'VERSION_CONFLICT' };
  }

  const presentes = CAMPOS_MUTABLES.filter((campo) => campo in patch);
  if (presentes.length === 0) return { ok: false, code: 'INVALID_PATCH' };

  const cambios: Partial<DossierFields> = {};
  for (const campo of presentes) {
    (cambios as Record<string, unknown>)[campo] = (patch as Record<string, unknown>)[campo];
  }
  const error = validarCampos(cambios);
  if (error) return { ok: false, code: error };

  const evidencia = 'evidence' in patch ? conFechasDeServidor(patch.evidence ?? [], now) : actual.evidence;
  const siguiente: Dossier = {
    ...actual,
    ...cambios,
    evidence: evidencia,
    version: actual.version + 1,
    ultimoEventoId: eventId,
    updatedAt: now,
  };
  return { ok: true, dossier: siguiente, currentVersion: actual.version, nextVersion: siguiente.version, replayed: false };
}

/** Handler puro de los dos eventos Mongo definidos en API_CONTRACT §7. */
export function applyMongoEvent(
  actual: Dossier | null,
  event: MongoDossierEvent,
  now: Instant,
): DossierResult {
  if (event.payloadVersion !== 1) return { ok: false, code: 'EVENT_MISMATCH' };

  if (event.eventType === 'INCIDENCIA_REGISTRADA') {
    if (actual === null) {
      const dossier = createDossier(event, now);
      return { ok: true, dossier, currentVersion: dossier.version, nextVersion: dossier.version, replayed: false };
    }
    if (actual.ultimoEventoId === event.eventId) {
      return { ok: true, dossier: actual, currentVersion: actual.version, nextVersion: actual.version, replayed: true };
    }
    if (actual.id !== event.payload.dossierId || actual.version < event.payload.version) {
      return { ok: false, code: 'EVENT_MISMATCH' };
    }
    return { ok: true, dossier: actual, currentVersion: actual.version, nextVersion: actual.version, replayed: true };
  }

  if (actual === null) return { ok: false, code: 'EVENT_MISMATCH' };
  if (event.payload.incidentId !== actual.incidentId) return { ok: false, code: 'EVENT_MISMATCH' };
  if (event.payload.nextVersion !== event.payload.expectedVersion + 1) {
    return { ok: false, code: 'EVENT_MISMATCH' };
  }
  const patch: DossierPatch = {
    ...(event.payload.changes as Omit<DossierPatch, 'expectedVersion'>),
    expectedVersion: event.payload.expectedVersion,
  };
  return applyDossierPatch(actual, patch, event.eventId, now);
}

/** Almacén inyectado: en producción lo implementa el driver Mongo (DOC-05). */
export interface DossierStore {
  findByIncident(incidentId: UUID): Promise<Dossier | null>;
  insert(dossier: Dossier): Promise<boolean>; // false si violó UQ(incidencia_id)
  cas(incidentId: UUID, expectedVersion: number, dossier: Dossier): Promise<boolean>;
}

export interface DossierRepository {
  ensureCreated(event: IncidenciaRegistradaEvent, now: Instant): Promise<DossierResult>;
  update(incidentId: UUID, patch: DossierPatch, eventId: UUID, now: Instant): Promise<DossierResult>;
  find(incidentId: UUID): Promise<Dossier | null>;
}

export function createDossierRepository(store: DossierStore): DossierRepository {
  return {
    async find(incidentId) {
      return store.findByIncident(incidentId);
    },
    async ensureCreated(event, now) {
      const actual = await store.findByIncident(event.payload.incidentId);
      const resultado = applyMongoEvent(actual, event, now);
      if (!resultado.ok || resultado.replayed) return resultado;
      if (!(await store.insert(resultado.dossier))) {
        const ganador = await store.findByIncident(event.payload.incidentId);
        return applyMongoEvent(ganador, event, now);
      }
      return resultado;
    },
    async update(incidentId, patch, eventId, now) {
      const actual = await store.findByIncident(incidentId);
      if (actual === null) return { ok: false, code: 'EVENT_MISMATCH' };
      const resultado = applyDossierPatch(actual, patch, eventId, now);
      if (!resultado.ok || resultado.replayed) return resultado;
      if (!(await store.cas(incidentId, resultado.currentVersion, resultado.dossier))) {
        const ganador = await store.findByIncident(incidentId);
        if (ganador?.ultimoEventoId === eventId) {
          return { ok: true, dossier: ganador, currentVersion: ganador.version, nextVersion: ganador.version, replayed: true };
        }
        return { ok: false, code: 'VERSION_CONFLICT' };
      }
      return resultado;
    },
  };
}

/** Normaliza la respuesta 202 del endpoint PATCH /incidents/:id/dossier. */
export function toDossierAccepted(resultado: DossierResult & { ok: true }, incidentId: UUID): DossierAccepted {
  return {
    incidentId,
    currentVersion: resultado.currentVersion,
    expectedVersion: resultado.nextVersion,
    dossierStatus: 'PENDIENTE',
  };
}
