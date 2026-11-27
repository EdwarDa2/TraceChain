/**
 * Adaptadores documentales de I-2 (puente con la infraestructura de I-1).
 * Fuentes: DATA_MODEL.md §3, API_CONTRACT.md §2/§8, RN-116.
 *
 * No importa el driver `mongodb` en tiempo de ejecución: define una interfaz
 * estructural mínima que `mongodb` 6.x satisface. Así los puertos se pueden
 * probar hoy con un doble y, cuando BASE-01/02 existan, se conecta con
 * `client.db(process.env.MONGODB_DATABASE)` sin cambiar la lógica.
 */

import type {
  Dossier,
  DossierStore,
  Finding,
  Evidence,
} from '../../modules/incidents/dossier.mts';
import type {
  Inspection,
  QualityReaderPorts,
  DossierSnapshot,
} from '../../modules/quality/quality-aggregations.mts';

export type MongoDocumento = Record<string, unknown>;

export interface MongoLikeCollection {
  findOne(filter: Record<string, unknown>): Promise<MongoDocumento | null>;
  find(filter: Record<string, unknown>): {
    sort(orden: Record<string, 1 | -1>): { toArray(): Promise<MongoDocumento[]> };
  };
  insertOne(documento: MongoDocumento): Promise<unknown>;
  updateOne(
    filtro: Record<string, unknown>,
    actualizacion: Record<string, unknown>,
    opciones?: Record<string, unknown>,
  ): Promise<{ matchedCount?: number; upsertedCount?: number }>;
}

export interface MongoLikeDb {
  collection(nombre: string): MongoLikeCollection;
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : valor === null || valor === undefined ? '' : String(valor);
}

function fechaIso(valor: unknown): string {
  return valor instanceof Date ? valor.toISOString() : texto(valor);
}

function arreglo(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
}

function esConflictoUnico(error: unknown): boolean {
  const dato = objeto(error);
  return dato.code === 11000 || dato.codeName === 'DuplicateKey';
}

function hallazgoDesdeDocumento(valor: unknown): Finding {
  const dato = objeto(valor);
  return {
    type: texto(dato.tipo) as Finding['type'],
    parameter: dato.parametro === null ? null : texto(dato.parametro),
    description: texto(dato.descripcion),
    severity: texto(dato.severidad) as Finding['severity'],
  };
}

function evidenciaDesdeDocumento(valor: unknown): Evidence {
  const dato = objeto(valor);
  return {
    type: texto(dato.tipo) as Evidence['type'],
    reference: texto(dato.referencia),
    description: dato.descripcion === null ? null : texto(dato.descripcion),
    registeredAt: fechaIso(dato.fecha_registro),
  };
}

export function dossierDesdeDocumento(documento: MongoDocumento): Dossier {
  return {
    id: texto(documento._id),
    incidentId: texto(documento.incidencia_id),
    description: texto(documento.descripcion),
    inspectionIds: arreglo(documento.inspecciones_ids).map(texto),
    findings: arreglo(documento.hallazgos).map(hallazgoDesdeDocumento),
    evidence: arreglo(documento.evidencias).map(evidenciaDesdeDocumento),
    notes: documento.observaciones === null ? null : texto(documento.observaciones),
    detailedResolution: documento.resolucion_detallada === null ? null : texto(documento.resolucion_detallada),
    version: Number(documento.version ?? 0),
    ultimoEventoId: texto(documento.ultimo_evento_id),
    createdAt: fechaIso(documento.created_at),
    updatedAt: fechaIso(documento.updated_at),
  };
}

export function dossierADocumento(dossier: Dossier, incluirIdentidad = true): MongoDocumento {
  const documento: MongoDocumento = {
    incidencia_id: dossier.incidentId,
    descripcion: dossier.description,
    inspecciones_ids: [...dossier.inspectionIds],
    hallazgos: dossier.findings.map((hallazgo) => ({
      tipo: hallazgo.type,
      parametro: hallazgo.parameter,
      descripcion: hallazgo.description,
      severidad: hallazgo.severity,
    })),
    evidencias: dossier.evidence.map((evidencia) => ({
      tipo: evidencia.type,
      referencia: evidencia.reference,
      descripcion: evidencia.description,
      fecha_registro: new Date(evidencia.registeredAt),
    })),
    observaciones: dossier.notes,
    resolucion_detallada: dossier.detailedResolution,
    version: dossier.version,
    ultimo_evento_id: dossier.ultimoEventoId,
    created_at: new Date(dossier.createdAt),
    updated_at: new Date(dossier.updatedAt),
  };
  if (incluirIdentidad) {
    documento._id = dossier.id; // _id es inmutable: jamás se incluye en $set
  }
  return documento;
}

/** Implementación de DossierStore sobre la colección E-16. */
export function createMongoDossierStore(db: MongoLikeDb): DossierStore {
  const coleccion = db.collection('expedientes_incidencias');
  return {
    async findByIncident(incidentId) {
      const documento = await coleccion.findOne({ incidencia_id: incidentId });
      return documento === null ? null : dossierDesdeDocumento(documento);
    },
    async insert(dossier) {
      try {
        await coleccion.insertOne(dossierADocumento(dossier, true));
        return true;
      } catch (error) {
        if (esConflictoUnico(error)) return false;
        throw error;
      }
    },
    async cas(incidentId, expectedVersion, dossier) {
      const resultado = await coleccion.updateOne(
        { incidencia_id: incidentId, version: expectedVersion },
        { $set: dossierADocumento(dossier, false) },
      );
      return (resultado.matchedCount ?? 0) > 0;
    },
  };
}

export function inspeccionDesdeDocumento(documento: MongoDocumento): Inspection {
  return {
    id: texto(documento._id),
    code: texto(documento.codigo),
    lotId: texto(documento.lote_id),
    productId: texto(documento.producto_id),
    inspectedAt: fechaIso(documento.fecha_inspeccion),
    result: texto(documento.resultado) === 'CONFORME' ? 'CONFORME' : 'NO_CONFORME',
    findings: arreglo(documento.hallazgos).map(hallazgoDesdeDocumento),
  };
}

/** Implementación de QualityReaderPorts sobre E-13 y E-16. */
export function createMongoQualityPorts(db: MongoLikeDb): QualityReaderPorts {
  const inspecciones = db.collection('inspecciones_calidad');
  const expedientes = createMongoDossierStore(db);

  return {
    async inspectionById(id) {
      const documento = await inspecciones.findOne({ _id: id });
      return documento === null ? null : inspeccionDesdeDocumento(documento);
    },
    async inspectionsByIds(ids) {
      if (ids.length === 0) return [];
      const documentos = await inspecciones.find({ _id: { $in: ids } }).sort({ fecha_inspeccion: -1 }).toArray();
      return documentos.map(inspeccionDesdeDocumento);
    },
    async dossierByIncident(incidentId): Promise<DossierSnapshot> {
      const expediente = await expedientes.findByIncident(incidentId);
      const documentos = expediente === null
        ? []
        : await inspecciones.find({ _id: { $in: expediente.inspectionIds } }).sort({ fecha_inspeccion: -1 }).toArray();
      return {
        dossierStatus: expediente === null ? 'PENDIENTE' : 'SINCRONIZADO',
        status: expediente === null ? 'PARCIAL' : 'COMPLETO',
        dossier: expediente,
        inspections: expediente === null ? null : documentos.map(inspeccionDesdeDocumento),
        warnings: [],
      };
    },
  };
}
