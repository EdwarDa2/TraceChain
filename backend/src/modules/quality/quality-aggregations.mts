/**
 * Agregaciones de calidad y puerto QualityReader de I-2.
 * Fuentes: API_CONTRACT.md §2/§4/§8, DATA_MODEL.md §3, RF-19, RN-127, QM-02..08, PM-17/18.
 * Tipos estructurales que replican el contrato oficial; se sustituirán por imports
 * de packages/contracts cuando BASE-05 esté disponible. Sin NestJS ni driver Mongo.
 */

export type UUID = string;
export type Instant = string;
export type InspectionResult = 'CONFORME' | 'NO_CONFORME';
export type FindingType =
  | 'IMPUREZAS' | 'HUMEDAD' | 'PESO' | 'EMPAQUE' | 'APARIENCIA'
  | 'TEXTURA' | 'TEMPERATURA' | 'OTRO';
export type Severity = 'BAJA' | 'MEDIA' | 'ALTA';
export type Count = number;

export interface Finding {
  type: FindingType;
  parameter: string | null;
  description: string;
  severity: Severity;
}

/** Subconjunto de Inspection usado por las agregaciones (API_CONTRACT §2). */
export interface Inspection {
  id: UUID;
  code: string;
  lotId: UUID;
  productId: UUID;
  inspectedAt: Instant;
  result: InspectionResult;
  findings: Finding[];
}

export interface ProductRef {
  id: UUID;
  name: string;
}

export interface QualityCount {
  total: Count;
  conforming: Count;
  nonConforming: Count;
  nonConformingPercentage: number | null;
}

export interface QualitySummary extends QualityCount {
  byProduct: (QualityCount & { productId: UUID; productName: string })[];
}

export interface FindingCount {
  key: FindingType | Severity;
  count: Count;
}

export interface LotQuality {
  lotId: UUID;
  totalInspections: Count;
  conforming: Count;
  nonConforming: Count;
  latestInspectionId: UUID | null;
}

/** DossierView se mantiene opaco: la capa Mongo produce el documento completo. */
export interface DossierSnapshot {
  dossierStatus: string;
  status: string;
  dossier: unknown | null;
  inspections: Inspection[] | null;
  warnings: unknown[];
}

const LIMITE_POR_DEFECTO = 20;

function porcentaje(noConforme: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((noConforme / total) * 10000) / 100;
}

function contar(inspecciones: Inspection[]): { total: Count; conforming: Count; nonConforming: Count } {
  let conforming = 0;
  let nonConforming = 0;
  for (const inspeccion of inspecciones) {
    if (inspeccion.result === 'CONFORME') conforming += 1;
    else if (inspeccion.result === 'NO_CONFORME') nonConforming += 1;
  }
  return { total: inspecciones.length, conforming, nonConforming };
}

/** Resumen global. Porcentaje con dos decimales; null si el denominador es cero. */
export function summarizeQuality(inspecciones: Inspection[]): QualityCount {
  const conteo = contar(inspecciones);
  return { ...conteo, nonConformingPercentage: porcentaje(conteo.nonConforming, conteo.total) };
}

/**
 * Resumen por producto (QM-05/QM-06). Los productos sin inspecciones aparecen con
 * conteos en cero y porcentaje null; los nombres vienen de PostgreSQL, no de Mongo.
 * Las inspecciones con productId ausente en el catálogo se ignoran: PG es autoridad.
 */
export function summarizeByProduct(inspecciones: Inspection[], productos: ProductRef[]): QualitySummary {
  const catalogo = new Set(productos.map((producto) => producto.id));
  const conocidas = inspecciones.filter((inspeccion) => catalogo.has(inspeccion.productId));
  const global = summarizeQuality(conocidas);
  const porProducto = new Map<UUID, Inspection[]>();

  for (const inspeccion of conocidas) {
    const lista = porProducto.get(inspeccion.productId) ?? [];
    lista.push(inspeccion);
    porProducto.set(inspeccion.productId, lista);
  }

  return {
    ...global,
    byProduct: productos.map((producto) => {
      const conteo = contar(porProducto.get(producto.id) ?? []);
      return {
        productId: producto.id,
        productName: producto.name,
        ...conteo,
        nonConformingPercentage: porcentaje(conteo.nonConforming, conteo.total),
      };
    }),
  };
}

/**
 * Cuenta elementos de los arreglos `findings` (no documentos), por tipo o severidad.
 * Orden: count descendente y clave ascendente como desempate (API_CONTRACT §3).
 */
export function countFindings(
  inspecciones: Inspection[],
  groupBy: 'type' | 'severity' = 'type',
  limit: Count = LIMITE_POR_DEFECTO,
): FindingCount[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError('limit debe ser entero entre 1 y 100');
  }

  const conteos = new Map<string, Count>();
  for (const inspeccion of inspecciones) {
    for (const hallazgo of inspeccion.findings) {
      const clave = groupBy === 'type' ? hallazgo.type : hallazgo.severity;
      conteos.set(clave, (conteos.get(clave) ?? 0) + 1);
    }
  }

  return [...conteos.entries()]
    .map(([clave, count]) => ({ key: clave as FindingType | Severity, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)))
    .slice(0, limit);
}

/**
 * Resumen por lote (QM-10, QualityReader.summarizeLots). Incluye lotes sin
 * inspecciones con total 0. El último hallazgo se desempata por fecha, código y UUID.
 */
export function summarizeLots(lotIds: UUID[], inspecciones: Inspection[]): LotQuality[] {
  return lotIds.map((lotId) => {
    const propias = inspecciones.filter((inspeccion) => inspeccion.lotId === lotId);
    const conteo = contar(propias);
    let latest: Inspection | null = null;
    for (const inspeccion of propias) {
      if (latest === null ||
          inspeccion.inspectedAt > latest.inspectedAt ||
          (inspeccion.inspectedAt === latest.inspectedAt && inspeccion.code < latest.code) ||
          (inspeccion.inspectedAt === latest.inspectedAt && inspeccion.code === latest.code && inspeccion.id < latest.id)) {
        latest = inspeccion;
      }
    }
    return {
      lotId,
      totalInspections: conteo.total,
      conforming: conteo.conforming,
      nonConforming: conteo.nonConforming,
      latestInspectionId: latest?.id ?? null,
    };
  });
}

/** Dependencias inyectadas: la capa Mongo real las implementa en DOC-04/DOC-05. */
export interface QualityReaderPorts {
  inspectionById(id: UUID): Promise<Inspection | null>;
  inspectionsByIds(ids: UUID[]): Promise<Inspection[]>;
  dossierByIncident(incidentId: UUID): Promise<DossierSnapshot>;
}

export interface QualityReader {
  inspection(id: UUID): Promise<Inspection | null>;
  inspectionsByIds(ids: UUID[]): Promise<Inspection[]>;
  summarizeLots(ids: UUID[]): Promise<LotQuality[]>;
  dossier(incidentId: UUID): Promise<DossierSnapshot>;
}

/**
 * Implementación del puerto de API_CONTRACT §8. Las lecturas delegan en repositorios
 * inyectados; los errores de fuente no se convierten en arreglos vacíos (RN-124).
 */
export function createQualityReader(ports: QualityReaderPorts): QualityReader {
  return {
    inspection: (id) => ports.inspectionById(id),
    inspectionsByIds: (ids) => ports.inspectionsByIds(ids),
    summarizeLots: async (ids) => summarizeLots(ids, await ports.inspectionsByIds(ids)),
    dossier: (incidentId) => ports.dossierByIncident(incidentId),
  };
}
