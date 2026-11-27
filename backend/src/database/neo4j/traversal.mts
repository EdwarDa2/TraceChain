import type { Driver, Session } from 'neo4j-driver';

export type Direction = 'FORWARD' | 'BACKWARD';
export type GraphReachability = {
  rootId: string;
  lots: { lotId: string; code: string; depth: number }[];
  status: 'COMPLETO' | 'PARCIAL';
  warnings: ('DEPTH_LIMIT' | 'RESULT_LIMIT' | 'TIME_LIMIT')[];
};

const MAX_LOTS = 10_000;
const MAX_DEPTH = 20;
const DEADLINE_MS = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function checkId(id: string) {
  if (!UUID.test(id)) throw new Error('VALIDATION_ERROR');
}
function checkDepth(depth: number) {
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) throw new Error('VALIDATION_ERROR');
}

// Un salto corresponde a dos aristas dirigidas; no se avanza por co-insumos,
// proveedores, productos ni distribuciones.
const NEXT = {
  FORWARD: `UNWIND $ids AS lotId
    MATCH (source:Lote {id:lotId})-[:UTILIZADO_EN]->(:Proceso)-[:GENERA]->(target:Lote)
    RETURN DISTINCT target.id AS id, target.codigo AS code ORDER BY id`,
  BACKWARD: `UNWIND $ids AS lotId
    MATCH (source:Lote {id:lotId})<-[:GENERA]-(:Proceso)<-[:UTILIZADO_EN]-(target:Lote)
    RETURN DISTINCT target.id AS id, target.codigo AS code ORDER BY id`,
} as const;

async function neighbors(session: Session, ids: string[], direction: Direction, deadline: number) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;
  const result = await session.executeRead(
    (tx) => tx.run(NEXT[direction], { ids }), { timeout: remaining },
  );
  if (Date.now() >= deadline) return null;
  return result.records.map((record) => ({ lotId: record.get('id') as string, code: record.get('code') as string }));
}

/** BFS por transformaciones; explora una frontera extra para no declarar parcial un límite exacto. */
export async function traverseLots(driver: Driver, database: string, rootId: string,
  direction: Direction, maxDepth = 10, maxLots = MAX_LOTS): Promise<GraphReachability> {
  checkId(rootId);
  checkDepth(maxDepth);
  if (!Number.isInteger(maxLots) || maxLots < 1 || maxLots > MAX_LOTS) throw new Error('VALIDATION_ERROR');
  const deadline = Date.now() + DEADLINE_MS;
  const session = driver.session({ database });
  try {
    const root = await session.executeRead((tx) => tx.run(
      'MATCH (l:Lote {id:$id}) RETURN l.id AS id', { id: rootId },
    ), { timeout: DEADLINE_MS });
    if (root.records.length !== 1) throw new Error('GRAPH_INCONSISTENT');
    const visited = new Set([rootId]);
    const lots: GraphReachability['lots'] = [];
    const warnings = new Set<GraphReachability['warnings'][number]>();
    let frontier = [rootId];
    for (let depth = 1; frontier.length > 0; depth++) {
      const next = await neighbors(session, frontier, direction, deadline);
      if (next === null) {
        warnings.add('TIME_LIMIT');
        break;
      }
      const newLots = next.filter((lot) => !visited.has(lot.lotId));
      if (depth > maxDepth) {
        if (newLots.length > 0) warnings.add('DEPTH_LIMIT');
        break;
      }
      const available = maxLots - visited.size;
      if (newLots.length > available) warnings.add('RESULT_LIMIT');
      const accepted = newLots.slice(0, Math.max(0, available));
      for (const lot of accepted) {
        visited.add(lot.lotId);
        lots.push({ ...lot, depth });
      }
      if (warnings.has('RESULT_LIMIT')) break;
      frontier = accepted.map((lot) => lot.lotId);
    }
    return { rootId, lots, status: warnings.size > 0 ? 'PARCIAL' : 'COMPLETO', warnings: [...warnings] };
  } finally {
    await session.close();
  }
}

/** Intersección estricta de antecedentes (2..5 raíces distintas). */
export async function commonOrigins(driver: Driver, database: string, rootIds: string[], maxDepth = 10) {
  if (rootIds.length < 2 || rootIds.length > 5 || new Set(rootIds).size !== rootIds.length) {
    throw new Error('VALIDATION_ERROR');
  }
  const results = await Promise.all(rootIds.map((id) => traverseLots(driver, database, id, 'BACKWARD', maxDepth)));
  const first = results[0]!;
  const otherSets = results.slice(1).map((result) => new Set(result.lots.map((lot) => lot.lotId)));
  return {
    lots: first.lots.filter((lot) => otherSets.every((set) => set.has(lot.lotId))),
    status: results.some((result) => result.status === 'PARCIAL') ? 'PARCIAL' as const : 'COMPLETO' as const,
    warnings: [...new Set(results.flatMap((result) => result.warnings))],
  };
}

/** Genealogía combina recorridos independientes; las raíces no son descendientes. */
export async function genealogy(driver: Driver, database: string, rootId: string, maxDepth = 10) {
  const [forward, backward] = await Promise.all([
    traverseLots(driver, database, rootId, 'FORWARD', maxDepth),
    traverseLots(driver, database, rootId, 'BACKWARD', maxDepth),
  ]);
  return {
    rootId,
    forward: forward.lots,
    backward: backward.lots,
    status: forward.status === 'PARCIAL' || backward.status === 'PARCIAL'
      ? 'PARCIAL' as const : 'COMPLETO' as const,
    warnings: [...new Set([...forward.warnings, ...backward.warnings])],
  };
}

/** Solo proveedores de lotes recibidos en el conjunto de antecedentes verificado. */
export async function originSuppliers(driver: Driver, database: string, lotIds: string[]) {
  if (lotIds.length > MAX_LOTS) throw new Error('VALIDATION_ERROR');
  lotIds.forEach(checkId);
  if (!lotIds.length) return [];
  const result = await driver.executeQuery(`UNWIND $ids AS lotId
    MATCH (s:Proveedor)-[:SUMINISTRA]->(l:Lote {id:lotId})
    RETURN DISTINCT s.id AS supplierId, s.codigo AS code, s.nombre AS name, l.id AS lotId
    ORDER BY supplierId, lotId`, { ids: [...new Set(lotIds)] }, { database });
  return result.records.map((record) => ({
    supplierId: record.get('supplierId') as string, code: record.get('code') as string,
    name: record.get('name') as string, lotId: record.get('lotId') as string,
  }));
}

/** Procesos de transformación que conectan lotes del conjunto entregado. */
export async function productiveProcesses(driver: Driver, database: string, lotIds: string[]) {
  if (lotIds.length > MAX_LOTS) throw new Error('VALIDATION_ERROR');
  lotIds.forEach(checkId);
  if (!lotIds.length) return [];
  const result = await driver.executeQuery(`UNWIND $ids AS lotId
    MATCH (l:Lote {id:lotId})-[:UTILIZADO_EN]->(p:Proceso)-[:GENERA]->(o:Lote)
    WHERE o.id IN $ids
    RETURN DISTINCT p.id AS processId, p.codigo AS code, p.nombre AS name
    ORDER BY processId`, { ids: [...new Set(lotIds)] }, { database });
  return result.records.map((record) => ({
    processId: record.get('processId') as string, code: record.get('code') as string,
    name: record.get('name') as string,
  }));
}

/** Destinos históricos de lotes ya verificados; jamás crean dependencia productiva. */
export async function historicalDestinations(driver: Driver, database: string, lotIds: string[]) {
  if (lotIds.length > MAX_LOTS) throw new Error('VALIDATION_ERROR');
  lotIds.forEach(checkId);
  if (lotIds.length === 0) return [];
  const result = await driver.executeQuery(`UNWIND $ids AS lotId
    MATCH (l:Lote {id:lotId})-[r:INCLUIDO_EN]->(d:Distribucion)-[:ENTREGADO_A]->(u:Ubicacion)
    RETURN DISTINCT d.id AS distributionId, d.codigo AS distributionCode,
      l.id AS lotId, u.id AS locationId, u.nombre AS locationName,
      r.cantidad_milesimas AS quantityThousandths, r.unidad AS unit
    ORDER BY distributionId, lotId`, { ids: [...new Set(lotIds)] }, { database });
  return result.records.map((record) => ({
    distributionId: record.get('distributionId') as string,
    distributionCode: record.get('distributionCode') as string,
    lotId: record.get('lotId') as string,
    locationId: record.get('locationId') as string,
    locationName: record.get('locationName') as string,
    quantityThousandths: record.get('quantityThousandths').toString() as string,
    unit: record.get('unit') as string,
  }));
}

type ProductionPath = { lotIds: string[]; processIds: string[]; edgeIds: string[]; depth: number };
const PATH_NEXT = `UNWIND $ids AS lotId
  MATCH (source:Lote {id:lotId})-[used:UTILIZADO_EN]->(process:Proceso)-[generated:GENERA]->(target:Lote)
  RETURN source.id AS sourceId, process.id AS processId, target.id AS targetId,
    used.id AS usedId, generated.id AS generatedId
  ORDER BY sourceId, usedId, generatedId, targetId`;

/** Enumeración acotada por nivel; ninguna ruta avanza por otro insumo del proceso. */
export async function productionPaths(driver: Driver, database: string, sourceId: string, targetId: string,
  mode: 'SHORTEST' | 'ALL', maxDepth = 10, maxPaths = 50) {
  checkId(sourceId);
  checkId(targetId);
  checkDepth(maxDepth);
  if (sourceId === targetId || !['SHORTEST', 'ALL'].includes(mode) ||
      !Number.isInteger(maxPaths) || maxPaths < 1 || maxPaths > 50) throw new Error('VALIDATION_ERROR');
  const deadline = Date.now() + DEADLINE_MS;
  const session = driver.session({ database });
  try {
    const roots = await session.executeRead((tx) => tx.run(
      'MATCH (l:Lote) WHERE l.id IN $ids RETURN l.id AS id', { ids: [sourceId, targetId] },
    ), { timeout: DEADLINE_MS });
    if (roots.records.length !== 2) throw new Error('GRAPH_INCONSISTENT');
    const warnings = new Set<'TIME_LIMIT' | 'RESULT_LIMIT' | 'PATH_LIMIT' | 'DEPTH_LIMIT'>();
    const paths: ProductionPath[] = [];
    let frontier: ProductionPath[] = [{ lotIds: [sourceId], processIds: [], edgeIds: [], depth: 0 }];
    for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) { warnings.add('TIME_LIMIT'); break; }
      const ids = [...new Set(frontier.map((path) => path.lotIds.at(-1)!))];
      const rows = await session.executeRead((tx) => tx.run(PATH_NEXT, { ids }), { timeout: remaining });
      const bySource = new Map<string, { processId: string; targetId: string; usedId: string; generatedId: string }[]>();
      for (const row of rows.records) {
        const source = row.get('sourceId') as string;
        const next = bySource.get(source) ?? [];
        next.push({ processId: row.get('processId'), targetId: row.get('targetId'),
          usedId: row.get('usedId'), generatedId: row.get('generatedId') });
        bySource.set(source, next);
      }
      const nextFrontier: ProductionPath[] = [];
      for (const previous of frontier) {
        for (const edge of bySource.get(previous.lotIds.at(-1)!) ?? []) {
          if (previous.lotIds.includes(edge.targetId)) continue;
          const path = {
            lotIds: [...previous.lotIds, edge.targetId],
            processIds: [...previous.processIds, edge.processId],
            edgeIds: [...previous.edgeIds, edge.usedId, edge.generatedId], depth,
          };
          if (edge.targetId === targetId) paths.push(path);
          else nextFrontier.push(path);
          if (nextFrontier.length > MAX_LOTS) { warnings.add('RESULT_LIMIT'); break; }
        }
        if (warnings.has('RESULT_LIMIT')) break;
      }
      paths.sort((a, b) => a.depth - b.depth ||
        a.edgeIds.join('|').localeCompare(b.edgeIds.join('|')));
      if (mode === 'SHORTEST' && paths.length > 0) {
        return { paths: paths.slice(0, 1), status: 'COMPLETO' as const, warnings: [] };
      }
      if (paths.length > maxPaths) { warnings.add('PATH_LIMIT'); break; }
      if (warnings.has('RESULT_LIMIT')) break;
      frontier = nextFrontier;
    }
    if (frontier.length > 0 && !warnings.has('TIME_LIMIT') &&
        !warnings.has('PATH_LIMIT') && !warnings.has('RESULT_LIMIT')) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) warnings.add('TIME_LIMIT');
      else {
        const rows = await session.executeRead((tx) => tx.run(PATH_NEXT,
          { ids: [...new Set(frontier.map((path) => path.lotIds.at(-1)!))] }), { timeout: remaining });
        if (rows.records.length > 0) warnings.add('DEPTH_LIMIT');
      }
    }
    return { paths: paths.slice(0, maxPaths), status: warnings.size ? 'PARCIAL' as const : 'COMPLETO' as const,
      warnings: [...warnings] };
  } finally {
    await session.close();
  }
}
