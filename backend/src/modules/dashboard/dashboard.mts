/**
 * Dashboard API y detalle integrado de lote de I-1 (REL-10/REL-11).
 * Fuentes: API_CONTRACT.md §3/§4, RF-03/RF-09, RN-124, QP-15/QI-01.
 * Lógica pura con lectores inyectados; nunca convierte un error de fuente en cero
 * ni presenta datos incompletos como completos.
 */

export type AnalysisStatus = 'COMPLETO' | 'PARCIAL' | 'NO_DISPONIBLE';

export interface Warning {
  code: string;
  message: string;
}

export interface Section<T> {
  status: AnalysisStatus;
  data: T | null;
  warnings: Warning[];
}

export interface Activity {
  type: 'RECEPCION' | 'PRODUCCION' | 'DISTRIBUCION' | 'INCIDENCIA';
  entityId: string;
  code: string;
  occurredAt: string;
  description: string;
}

export interface SystemStatus {
  status: 'AVAILABLE' | 'DEGRADED';
  sources?: unknown;
  sync?: unknown[];
}

export interface DashboardSummary {
  totalLots: number;
  totalProductions: number;
  activeIncidents: number;
  blockedLots: number;
}

export interface DashboardPorts {
  countLots(): Promise<number>;
  countProductions(): Promise<number>;
  countActiveIncidents(): Promise<number>;
  countBlockedLots(): Promise<number>;
  recentActivity(limit: number): Promise<Activity[]>;
  syncStatus(): Promise<SystemStatus>;
}

export function createDashboardService(ports: DashboardPorts) {
  return {
    async summary(): Promise<DashboardSummary> {
      const [totalLots, totalProductions, activeIncidents, blockedLots] = await Promise.all([
        ports.countLots(),
        ports.countProductions(),
        ports.countActiveIncidents(),
        ports.countBlockedLots(),
      ]);
      return { totalLots, totalProductions, activeIncidents, blockedLots };
    },
    async recentActivity(limit = 10): Promise<Activity[]> {
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        throw new Error('VALIDATION_ERROR: limit debe estar entre 1 y 50');
      }
      return ports.recentActivity(limit);
    },
    async systemStatus(): Promise<SystemStatus> {
      return ports.syncStatus();
    },
  };
}

export interface LotResumen {
  id: string;
  code: string;
  productId: string;
  productName: string;
}

export interface StockResumen {
  lotId: string;
  locationId: string;
  physicalQuantity: string;
}

export interface QualityResumen {
  lotId: string;
  totalInspections: number;
  conforming: number;
  nonConforming: number;
  latestInspectionId: string | null;
}

export interface GenealogyResumen {
  status: string;
  lots: unknown[];
  metadata: { maxDepth: number };
}

export interface LotDetailPorts {
  lot(id: string): Promise<LotResumen | null>;
  supplier(lotId: string): Promise<{ id: string; name: string } | null>;
  stocks(lotId: string): Promise<StockResumen[]>;
  quality(lotId: string): Promise<QualityResumen>;
  genealogy(lotId: string, maxDepth: number): Promise<GenealogyResumen>;
  incidents(lotId: string): Promise<{ id: string }[]>;
  activeBlocks(lotId: string): Promise<{ id: string }[]>;
  sourceStatus(): Promise<unknown>;
}

export interface LotDetails {
  lot: LotResumen;
  supplier: { id: string; name: string } | null;
  stocks: Section<StockResumen[]>;
  quality: Section<QualityResumen>;
  genealogy: Section<GenealogyResumen>;
  incidents: Section<{ id: string }[]>;
  activeBlocks: Section<{ id: string }[]>;
  sourceStatus: unknown;
  status: AnalysisStatus;
  warnings: Warning[];
}

async function seccion<T>(carga: () => Promise<T>, codigo: string): Promise<Section<T>> {
  try {
    return { status: 'COMPLETO', data: await carga(), warnings: [] };
  } catch {
    return {
      status: 'NO_DISPONIBLE',
      data: null,
      warnings: [{ code: codigo, message: 'La fuente requerida no está disponible' }],
    };
  }
}

export function createLotDetailsService(ports: LotDetailPorts) {
  return {
    async get(lotId: string, maxDepth = 10): Promise<LotDetails> {
      if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 20) {
        throw new Error('VALIDATION_ERROR: maxDepth debe estar entre 1 y 20');
      }
      const lote = await ports.lot(lotId);
      if (lote === null) throw new Error('RESOURCE_NOT_FOUND: lote inexistente');

      const [supplier, stocks, quality, genealogy, incidents, activeBlocks, sourceStatus] = await Promise.all([
        ports.supplier(lotId).catch(() => null),
        seccion(() => ports.stocks(lotId), 'STOCK_UNAVAILABLE'),
        seccion(() => ports.quality(lotId), 'QUALITY_UNAVAILABLE'),
        seccion(() => ports.genealogy(lotId, maxDepth), 'GRAPH_UNAVAILABLE'),
        seccion(() => ports.incidents(lotId), 'INCIDENTS_UNAVAILABLE'),
        seccion(() => ports.activeBlocks(lotId), 'BLOCKS_UNAVAILABLE'),
        ports.sourceStatus().catch(() => null),
      ]);

      const secciones = [stocks, quality, genealogy, incidents, activeBlocks];
      const completo = secciones.every((seccionActual) => seccionActual.status === 'COMPLETO');
      return {
        lot: lote,
        supplier,
        stocks,
        quality,
        genealogy,
        incidents,
        activeBlocks,
        sourceStatus,
        status: completo ? 'COMPLETO' : 'PARCIAL',
        warnings: secciones.flatMap((seccionActual) => seccionActual.warnings),
      };
    },
  };
}
