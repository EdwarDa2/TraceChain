/**
 * Trazabilidad HTTP de I-3 (GRA-03/GRA-05).
 * Fuentes: API_CONTRACT.md §3/§4, DATA_MODEL.md §4/§6, RN-69..77/121/122/124.
 * Neo4j aporta dependencias productivas; PostgreSQL aporta nombres, fechas y
 * destinos oficiales. Un recorrido limitado nunca se presenta como completo.
 */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import neo4j, { type Driver } from 'neo4j-driver';
import type {
  Destination, SourceStatus, TraceLot, TracePath, TraceProcess,
  TraceResult, TraceSupplier, Unit, Warning,
} from '@tracechain/contracts';
import { SqlService } from '../../database/postgres/sql.service';
import {
  genealogy as genealogyInNeo, originSuppliers, productiveProcesses,
  productionPaths, traverseLots,
} from '../../database/neo4j/traversal.mts';
import { productiveSubgraph } from '../../database/neo4j/subgraph.mts';
import { validateEnv } from '../../config/env.validation.mts';

type Row = Record<string, unknown>;
type Queue = { sequence: string; pending: number };
type LotLevel = { lotId: string; depth: number };
type Reachability = { lots: { lotId: string; code: string; depth: number }[];
  status: 'COMPLETO' | 'PARCIAL';
  warnings: ('DEPTH_LIMIT' | 'RESULT_LIMIT' | 'TIME_LIMIT')[] };
type ProcessRow = { processId: string; code: string; name: string };
type SupplierRow = { supplierId: string; code: string; name: string; lotId: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_DETAIL = 10_000;

function notice(code: Warning['code'], message: string): Warning {
  return { code, message };
}
function source(sync: SourceStatus['sync'], pendingEvents: number | null,
  availability: SourceStatus['availability'] = 'AVAILABLE'): SourceStatus {
  return { availability, sync, checkedAt: new Date().toISOString(), pendingEvents };
}

@Injectable()
export class TraceabilityService implements OnModuleDestroy {
  private readonly config = validateEnv(process.env);
  private readonly graph: Driver = neo4j.driver(this.config.NEO4J_URI,
    neo4j.auth.basic(this.config.NEO4J_USER, this.config.NEO4J_PASSWORD));
  constructor(private readonly sql: SqlService) {}

  private async queue(): Promise<Queue> {
    const result = await this.sql.pool.query<{ sequence: string; pending: number }>(`SELECT
      COALESCE(max(secuencia),0)::text AS sequence,
      count(*) FILTER (WHERE estado <> 'COMPLETADO')::int AS pending
      FROM eventos_sincronizacion WHERE motor_destino='NEO4J'`);
    return result.rows[0]!;
  }

  /** Autoridad SQL: ningún ID del grafo se enriquece con datos inventados. */
  private async lotMeta(ids: string[]): Promise<Map<string, {
    code: string; productId: string; productName: string; productType: string;
  }>> {
    if (ids.length === 0) return new Map();
    const result = await this.sql.pool.query<Row>(`SELECT l.id, l.codigo, l.producto_id,
      p.nombre AS nombre_producto, p.tipo AS tipo_producto
      FROM lotes l JOIN productos p ON p.id=l.producto_id WHERE l.id=ANY($1)`, [ids]);
    if (result.rows.length !== ids.length) throw new Error('GRAPH_INCONSISTENT');
    return new Map(result.rows.map((row) => [String(row.id), {
      code: String(row.codigo), productId: String(row.producto_id),
      productName: String(row.nombre_producto), productType: String(row.tipo_producto),
    }]));
  }

  private async assertLots(ids: string[]): Promise<void> {
    for (const id of ids) {
      if (!UUID.test(id)) throw new Error('VALIDATION_ERROR');
    }
    const result = await this.sql.pool.query<{ total: string }>(
      'SELECT count(DISTINCT id)::text AS total FROM lotes WHERE id=ANY($1)', [ids]);
    if (Number(result.rows[0]!.total) !== new Set(ids).size) throw new Error('RESOURCE_NOT_FOUND');
  }

  private async processes(rows: ProcessRow[]): Promise<TraceProcess[]> {
    if (rows.length === 0) return [];
    const result = await this.sql.pool.query<Row>(
      'SELECT id, fecha_produccion FROM ordenes_produccion WHERE id=ANY($1)',
      [rows.map((row) => row.processId)]);
    const dates = new Map(result.rows.map((row) => [String(row.id), new Date(row.fecha_produccion as string).toISOString()]));
    return rows.map((row) => {
      const producedAt = dates.get(row.processId);
      if (!producedAt) throw new Error('GRAPH_INCONSISTENT');
      return { processId: row.processId, code: row.code, name: row.name, producedAt };
    }).sort((a, b) => a.processId.localeCompare(b.processId));
  }

  private async destinationsFor(lotIds: string[]): Promise<{ rows: Destination[]; truncated: boolean }> {
    if (lotIds.length === 0) return { rows: [], truncated: false };
    const result = await this.sql.pool.query<Row>(`SELECT d.id, d.codigo, dd.lote_id,
      d.ubicacion_destino_id, u.nombre AS nombre_ubicacion, d.fecha_distribucion,
      dd.cantidad, p.unidad_medida
      FROM detalle_distribuciones dd JOIN distribuciones d ON d.id=dd.distribucion_id
      JOIN ubicaciones u ON u.id=d.ubicacion_destino_id
      JOIN lotes l ON l.id=dd.lote_id JOIN productos p ON p.id=l.producto_id
      WHERE dd.lote_id=ANY($1)
      ORDER BY d.fecha_distribucion,d.id,dd.lote_id LIMIT $2`,
    [lotIds, MAX_DETAIL + 1]);
    const truncated = result.rows.length > MAX_DETAIL;
    return { rows: result.rows.slice(0, MAX_DETAIL).map((row) => ({
      distributionId: String(row.id), distributionCode: String(row.codigo),
      lotId: String(row.lote_id), locationId: String(row.ubicacion_destino_id),
      locationName: String(row.nombre_ubicacion),
      distributedAt: new Date(row.fecha_distribucion as string).toISOString(),
      transferredQuantity: String(row.cantidad), unit: row.unidad_medida as Unit,
    })), truncated };
  }

  private async suppliersFor(rows: SupplierRow[]): Promise<TraceSupplier[]> {
    return rows.map((row) => ({ supplierId: row.supplierId, code: row.code,
      name: row.name, lotId: row.lotId }));
  }

  private async graphFor(roots: string[], levels: LotLevel[]) {
    return productiveSubgraph(this.graph, this.config.NEO4J_DATABASE, roots, levels);
  }

  private async runNeo<T>(work: () => Promise<T>, pending: boolean): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof Error && error.message === 'GRAPH_INCONSISTENT') {
        throw new Error(pending ? 'GRAPH_SYNC_PENDING' : 'GRAPH_INCONSISTENT');
      }
      throw new Error('DATABASE_UNAVAILABLE');
    }
  }

  private async syncWarnings(before: Queue): Promise<{ warnings: Warning[]; after: Queue }> {
    const after = await this.queue();
    const warnings: Warning[] = [];
    if (before.pending || after.pending) warnings.push(notice('GRAPH_PENDING',
      'La proyección del grafo tiene eventos pendientes.'));
    if (before.sequence !== after.sequence) warnings.push(notice('CONCURRENT_CHANGES',
      'Se detectaron operaciones durante la lectura.'));
    return { warnings, after };
  }

  private traceWarnings(traversal: { warnings: Reachability['warnings'] }): Warning[] {
    return traversal.warnings.map((code) => notice(code,
      'El análisis se limitó; el alcance real puede ser mayor.'));
  }

  private async finish(queryType: TraceResult['queryType'], rootIds: string[], maxDepth: number,
    traversal: { status: 'COMPLETO' | 'PARCIAL' }, lots: TraceLot[], paths: TracePath[],
    destinations: Destination[], suppliers: TraceSupplier[], processes: TraceProcess[],
    graph: Awaited<ReturnType<typeof productiveSubgraph>>['graph'],
    visualizationTruncated: boolean, warnings: Warning[], before: Queue, after: Queue,
    summary: TraceResult['summary'], started: number): Promise<TraceResult> {
    const partial = warnings.length > 0 || traversal.status === 'PARCIAL';
    return {
      status: partial ? 'PARCIAL' : 'COMPLETO', queryType, rootLotIds: rootIds,
      summary, lots, paths, destinations, suppliers, processes, graph,
      metadata: {
        maxDepth, analysisTruncated: partial, visualizationTruncated,
        graphSynchronized: !before.pending && !after.pending && before.sequence === after.sequence,
        warnings, durationMs: performance.now() - started,
        analyzedAt: new Date().toISOString(),
        sourceStatus: {
          postgresql: source('NOT_APPLICABLE', null),
          mongodb: null,
          neo4j: source(before.pending || after.pending ? 'PENDING' : 'SYNCHRONIZED', after.pending),
        },
      },
    };
  }

  private async traceLots(levels: LotLevel[], direction: TraceLot['direction'],
    depthByRoot: Record<string, number> | null = null): Promise<TraceLot[]> {
    const meta = await this.lotMeta(levels.map((lot) => lot.lotId));
    return levels.map((lot) => {
      const item = meta.get(lot.lotId)!;
      return { lotId: lot.lotId, code: item.code, productId: item.productId,
        productName: item.productName, productType: item.productType as TraceLot['productType'],
        depth: lot.depth, direction, depthByRoot };
    }).sort((a, b) => a.depth - b.depth || a.code.localeCompare(b.code) ||
      a.lotId.localeCompare(b.lotId));
  }

  async forward(rootId: string, maxDepth: number): Promise<TraceResult> {
    const started = performance.now();
    await this.assertLots([rootId]);
    const before = await this.queue();
    const traversal = await this.runNeo(() => traverseLots(this.graph,
      this.config.NEO4J_DATABASE, rootId, 'FORWARD', maxDepth), before.pending > 0) as Reachability;
    const sync = await this.syncWarnings(before);
    const levels = traversal.lots.filter((lot) => lot.lotId !== rootId);
    const lots = await this.traceLots(levels, 'FORWARD');
    const ids = [rootId, ...levels.map((lot) => lot.lotId)];
    const [visual, processes, destinations] = await Promise.all([
      this.graphFor([rootId], levels),
      this.runNeo(() => productiveProcesses(this.graph, this.config.NEO4J_DATABASE, ids), before.pending > 0),
      this.destinationsFor(ids),
    ]);
    const warnings = [...this.traceWarnings(traversal), ...sync.warnings];
    if (destinations.truncated) warnings.push(notice('DETAIL_LIMIT',
      'Se alcanzó el límite de detalle de destinos.'));
    return this.finish('FORWARD', [rootId], maxDepth, traversal, lots, [], destinations.rows, [],
      await this.processes(processes as ProcessRow[]), visual.graph, visual.visualizationTruncated,
      warnings, before, sync.after, {
        directLots: lots.filter((lot) => lot.depth === 1).length,
        indirectLots: lots.filter((lot) => lot.depth > 1).length,
        totalDescendants: lots.length, totalAncestors: null, totalCommonLots: null,
        pathsReturned: null, minPathDepth: null, uniqueLots: lots.length,
      }, started);
  }

  async backward(rootId: string, maxDepth: number): Promise<TraceResult> {
    const started = performance.now();
    await this.assertLots([rootId]);
    const before = await this.queue();
    const traversal = await this.runNeo(() => traverseLots(this.graph,
      this.config.NEO4J_DATABASE, rootId, 'BACKWARD', maxDepth), before.pending > 0) as Reachability;
    const sync = await this.syncWarnings(before);
    const levels = traversal.lots.filter((lot) => lot.lotId !== rootId);
    const lots = await this.traceLots(levels, 'BACKWARD');
    const ids = [rootId, ...levels.map((lot) => lot.lotId)];
    const [visual, processes, suppliers] = await Promise.all([
      this.graphFor([rootId], levels),
      this.runNeo(() => productiveProcesses(this.graph, this.config.NEO4J_DATABASE, ids), before.pending > 0),
      this.runNeo(() => originSuppliers(this.graph, this.config.NEO4J_DATABASE, ids), before.pending > 0),
    ]);
    return this.finish('BACKWARD', [rootId], maxDepth, traversal, lots, [], [],
      await this.suppliersFor(suppliers as SupplierRow[]),
      await this.processes(processes as ProcessRow[]), visual.graph,
      visual.visualizationTruncated, [...this.traceWarnings(traversal), ...sync.warnings],
      before, sync.after, {
        directLots: lots.filter((lot) => lot.depth === 1).length,
        indirectLots: lots.filter((lot) => lot.depth > 1).length,
        totalDescendants: null, totalAncestors: lots.length, totalCommonLots: null,
        pathsReturned: null, minPathDepth: null, uniqueLots: lots.length,
      }, started);
  }

  async genealogy(rootId: string, maxDepth: number): Promise<TraceResult> {
    const started = performance.now();
    await this.assertLots([rootId]);
    const before = await this.queue();
    const traversal = await this.runNeo(() => genealogyInNeo(this.graph,
      this.config.NEO4J_DATABASE, rootId, maxDepth), before.pending > 0);
    const sync = await this.syncWarnings(before);
    const depths = new Map<string, { depth: number; forward: boolean; backward: boolean }>();
    for (const lot of traversal.forward) {
      depths.set(lot.lotId, { depth: lot.depth, forward: true, backward: false });
    }
    for (const lot of traversal.backward) {
      const current = depths.get(lot.lotId);
      if (current) { current.backward = true; }
      else { depths.set(lot.lotId, { depth: lot.depth, forward: false, backward: true }); }
    }
    const levels = [...depths].map(([lotId, item]) => ({ lotId, depth: item.depth }));
    const lots = await this.traceLots(levels, 'BOTH');
    for (const lot of lots) {
      const item = depths.get(lot.lotId)!;
      lot.direction = item.forward && item.backward ? 'BOTH' : item.forward ? 'FORWARD' : 'BACKWARD';
    }
    const ids = [rootId, ...levels.map((lot) => lot.lotId)];
    const [visual, processes, suppliers, destinations] = await Promise.all([
      this.graphFor([rootId], levels),
      this.runNeo(() => productiveProcesses(this.graph, this.config.NEO4J_DATABASE, ids), before.pending > 0),
      this.runNeo(() => originSuppliers(this.graph, this.config.NEO4J_DATABASE, ids), before.pending > 0),
      this.destinationsFor(ids),
    ]);
    const warnings = [...this.traceWarnings(traversal), ...sync.warnings];
    if (destinations.truncated) warnings.push(notice('DETAIL_LIMIT',
      'Se alcanzó el límite de detalle de destinos.'));
    return this.finish('GENEALOGY', [rootId], maxDepth, traversal, lots, [], destinations.rows,
      await this.suppliersFor(suppliers as SupplierRow[]),
      await this.processes(processes as ProcessRow[]), visual.graph,
      visual.visualizationTruncated, warnings, before, sync.after, {
        directLots: null, indirectLots: null,
        totalDescendants: traversal.forward.length, totalAncestors: traversal.backward.length,
        totalCommonLots: null, pathsReturned: null, minPathDepth: null, uniqueLots: lots.length,
      }, started);
  }

  async common(rootIds: string[], maxDepth: number): Promise<TraceResult> {
    const started = performance.now();
    if (rootIds.length < 2 || rootIds.length > 5 || new Set(rootIds).size !== rootIds.length) {
      throw new Error('VALIDATION_ERROR');
    }
    await this.assertLots(rootIds);
    const before = await this.queue();
    const traversals = await this.runNeo(() => Promise.all(rootIds.map((id) => traverseLots(
      this.graph, this.config.NEO4J_DATABASE, id, 'BACKWARD', maxDepth))), before.pending > 0) as Reachability[];
    const sync = await this.syncWarnings(before);
    const sets = traversals.map((item) => new Set(item.lots.filter((lot) =>
      !rootIds.includes(lot.lotId)).map((lot) => lot.lotId)));
    const byRoot = new Map(traversals.map((item, index) =>
      [rootIds[index]!, item.lots.filter((lot) => !rootIds.includes(lot.lotId))]));
    const ids = [...sets[0]!].filter((id) => sets.every((set) => set.has(id)));
    const depths = ids.map((id) => ({ lotId: id, depth: Math.min(...traversals.map((item) =>
      item.lots.find((lot) => lot.lotId === id)?.depth ?? maxDepth)) }));
    const lots = await this.traceLots(depths, 'COMMON', null);
    for (const lot of lots) {
      const perRoot: Record<string, number> = {};
      for (const [root, rootLots] of byRoot) {
        const found = rootLots.find((item) => item.lotId === lot.lotId);
        if (found) perRoot[root] = found.depth;
      }
      lot.depthByRoot = perRoot;
    }
    const visual = await this.runNeo(() => this.graphFor(rootIds, depths), before.pending > 0);
    const status = traversals.some((item) => item.status === 'PARCIAL') ? 'PARCIAL' as const : 'COMPLETO' as const;
    const warnings = [...new Set(traversals.flatMap((item) => this.traceWarnings(item))),
      ...sync.warnings];
    return this.finish('COMMON_ORIGINS', rootIds, maxDepth, { status }, lots, [], [], [],
      [], visual.graph, visual.visualizationTruncated, warnings, before, sync.after, {
        directLots: null, indirectLots: null, totalDescendants: null, totalAncestors: null,
        totalCommonLots: lots.length, pathsReturned: null, minPathDepth: null,
        uniqueLots: lots.length,
      }, started);
  }

  async paths(sourceId: string, targetId: string, mode: 'SHORTEST' | 'ALL',
    maxDepth: number, maxPaths: number): Promise<TraceResult> {
    const started = performance.now();
    await this.assertLots([sourceId, targetId]);
    const before = await this.queue();
    const found = await this.runNeo(() => productionPaths(this.graph, this.config.NEO4J_DATABASE,
      sourceId, targetId, mode, maxDepth, maxPaths), before.pending > 0);
    const sync = await this.syncWarnings(before);
    const depths = new Map<string, number>();
    const pathResults: TracePath[] = found.paths.map((path) => {
      const nodeIds: string[] = [];
      const edgeIds: string[] = [];
      path.lotIds.forEach((lotId, index) => {
        nodeIds.push(`Lote:${lotId}`);
        const processId = path.processIds[index];
        if (processId) nodeIds.push(`Proceso:${processId}`);
        const usedId = path.edgeIds[index * 2];
        const generatedId = path.edgeIds[index * 2 + 1];
        if (usedId) edgeIds.push(`UTILIZADO_EN:${usedId}`);
        if (generatedId) edgeIds.push(`GENERA:${generatedId}`);
      });
      return { nodeIds, edgeIds, depth: path.depth };
    });
    for (const path of found.paths) {
      path.lotIds.forEach((lotId, index) => {
        depths.set(lotId, Math.min(depths.get(lotId) ?? Infinity, index));
      });
    }
    const intermediate = [...depths].filter(([id]) => id !== sourceId && id !== targetId)
      .map(([lotId, depth]) => ({ lotId, depth }));
    const lots = await this.traceLots(intermediate, 'PATH');
    const processIds = [...new Set(found.paths.flatMap((path) => path.processIds))];
    const sqlProcesses = processIds.length === 0 ? [] :
      (await this.sql.pool.query<Row>(`SELECT id, codigo, nombre FROM ordenes_produccion
        WHERE id=ANY($1)`, [processIds])).rows;
    const processes: TraceProcess[] = await this.processes(sqlProcesses.map((row) => ({
      processId: String(row.id), code: String(row.codigo), name: String(row.nombre),
    })));
    const visual = await this.runNeo(() => this.graphFor([sourceId],
      [...depths].map(([lotId, depth]) => ({ lotId, depth }))), before.pending > 0);
    const presentEdges = new Set(visual.graph.edges.map((edge) => edge.id));
    const truncatedPaths = pathResults.some((path) =>
      path.edgeIds.some((id) => !presentEdges.has(id)));
    const warnings = found.warnings.map((code) => notice(code,
      'El listado de caminos se limitó; pueden existir más rutas.'))
      .concat(sync.warnings);
    return this.finish('PATHS', [sourceId, targetId], maxDepth, found, lots, pathResults, [],
      [], processes, visual.graph,
      visual.visualizationTruncated || truncatedPaths, warnings, before, sync.after, {
        directLots: null, indirectLots: null, totalDescendants: null, totalAncestors: null,
        totalCommonLots: null, pathsReturned: pathResults.length,
        minPathDepth: pathResults.reduce((min, path) => Math.min(min, path.depth), Infinity) === Infinity
          ? null : pathResults.reduce((min, path) => Math.min(min, path.depth), Infinity),
        uniqueLots: lots.length,
      }, started);
  }

  async onModuleDestroy(): Promise<void> {
    await this.graph.close();
  }
}
