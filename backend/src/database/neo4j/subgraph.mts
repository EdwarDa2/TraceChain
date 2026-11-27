import neo4j, { type Driver } from 'neo4j-driver';
import type { Graph, GraphEdge, GraphNode } from '@tracechain/contracts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_NODES = 500;
const MAX_EDGES = 1500;

type LotLevel = { lotId: string; depth: number };
type ProductiveSegment = {
  sourceId: string; processId: string; processCode: string; processName: string;
  targetId: string; usedId: string; usedQuantity: string; usedUnit: GraphEdge['unit'];
  generatedId: string; generatedQuantity: string; generatedUnit: GraphEdge['unit'];
};

function amount(thousandths: string): string {
  const value = BigInt(thousandths);
  return `${value / 1000n}.${(value % 1000n).toString().padStart(3, '0')}`;
}

/** Solo tramos productivos completos, priorizados por nivel e ID. Nunca inventa aristas. */
export async function productiveSubgraph(driver: Driver, database: string, roots: string[],
  lots: LotLevel[], maxNodes = MAX_NODES, maxEdges = MAX_EDGES):
  Promise<{ graph: Graph; visualizationTruncated: boolean }> {
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > MAX_NODES ||
      !Number.isInteger(maxEdges) || maxEdges < 1 || maxEdges > MAX_EDGES ||
      roots.length === 0 || roots.length > 5 || roots.length > maxNodes ||
      roots.some((id) => !UUID.test(id)) || new Set(roots).size !== roots.length ||
      lots.some(({ lotId, depth }) => !UUID.test(lotId) || !Number.isInteger(depth) || depth < 0)) {
    throw new Error('VALIDATION_ERROR');
  }
  const levels = new Map<string, number>();
  for (const root of roots) levels.set(root, 0);
  for (const lot of lots) {
    levels.set(lot.lotId, Math.min(levels.get(lot.lotId) ?? Infinity, lot.depth));
  }
  const ordered = [...levels].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const selected = ordered.slice(0, maxNodes);
  let visualizationTruncated = ordered.length > selected.length;
  const ids = selected.map(([id]) => id);
  const result = await driver.executeQuery(`UNWIND $ids AS id
    MATCH (l:Lote {id:id}) RETURN l.id AS id, l.codigo AS code ORDER BY id`,
  { ids }, { database });
  if (result.records.length !== ids.length) throw new Error('GRAPH_INCONSISTENT');
  const codes = new Map(result.records.map((record) =>
    [record.get('id') as string, record.get('code') as string]));
  const nodes: GraphNode[] = selected.map(([id, depth]) => ({
    id: `Lote:${id}`, entityId: id, type: 'Lote', label: codes.get(id)!,
    name: codes.get(id)!, depth,
  }));
  const edges: GraphEdge[] = [];
  // El segmento es el par de aristas de una transformación; LIMIT evita
  // materializar todo el grafo si el análisis tiene una ramificación grande.
  const segments = await driver.executeQuery(`MATCH (source:Lote)-[used:UTILIZADO_EN]->(p:Proceso)
    -[generated:GENERA]->(target:Lote)
    WHERE source.id IN $ids AND target.id IN $ids
    RETURN source.id AS sourceId, p.id AS processId, p.codigo AS processCode,
      p.nombre AS processName, target.id AS targetId, used.id AS usedId,
      used.cantidad_milesimas AS usedQuantity, used.unidad AS usedUnit,
      generated.id AS generatedId, generated.cantidad_milesimas AS generatedQuantity,
      generated.unidad AS generatedUnit
    ORDER BY sourceId, processId, targetId, usedId, generatedId
    LIMIT $limit`, { ids, limit: neo4j.int(MAX_EDGES + 1) }, { database });
  const pairs: ProductiveSegment[] = segments.records.map((record) => ({
    sourceId: record.get('sourceId'), processId: record.get('processId'),
    processCode: record.get('processCode'), processName: record.get('processName'),
    targetId: record.get('targetId'), usedId: record.get('usedId'),
    usedQuantity: record.get('usedQuantity').toString(), usedUnit: record.get('usedUnit'),
    generatedId: record.get('generatedId'),
    generatedQuantity: record.get('generatedQuantity').toString(),
    generatedUnit: record.get('generatedUnit'),
  }));
  pairs.sort((a, b) =>
    Math.max(levels.get(a.sourceId)!, levels.get(a.targetId)!) -
      Math.max(levels.get(b.sourceId)!, levels.get(b.targetId)!) ||
    a.processId.localeCompare(b.processId) || a.sourceId.localeCompare(b.sourceId) ||
    a.targetId.localeCompare(b.targetId) || a.usedId.localeCompare(b.usedId) ||
    a.generatedId.localeCompare(b.generatedId));
  const includedProcesses = new Set<string>();
  const includedEdges = new Set<string>();
  for (const pair of pairs) {
    const processNode = `Proceso:${pair.processId}`;
    const usedEdge = `UTILIZADO_EN:${pair.usedId}`;
    const generatedEdge = `GENERA:${pair.generatedId}`;
    const requiredNodes = includedProcesses.has(pair.processId) ? 0 : 1;
    const requiredEdges = Number(!includedEdges.has(usedEdge)) + Number(!includedEdges.has(generatedEdge));
    if (nodes.length + requiredNodes > maxNodes || edges.length + requiredEdges > maxEdges) {
      visualizationTruncated = true;
      continue;
    }
    if (requiredNodes) {
      nodes.push({ id: processNode, entityId: pair.processId, type: 'Proceso',
        label: pair.processCode, name: pair.processName, depth: null });
      includedProcesses.add(pair.processId);
    }
    if (!includedEdges.has(usedEdge)) {
      edges.push({ id: usedEdge, source: `Lote:${pair.sourceId}`, target: processNode,
        type: 'UTILIZADO_EN', quantity: amount(pair.usedQuantity), unit: pair.usedUnit });
      includedEdges.add(usedEdge);
    }
    if (!includedEdges.has(generatedEdge)) {
      edges.push({ id: generatedEdge, source: processNode, target: `Lote:${pair.targetId}`,
        type: 'GENERA', quantity: amount(pair.generatedQuantity), unit: pair.generatedUnit });
      includedEdges.add(generatedEdge);
    }
  }
  return { graph: { nodes, edges },
    visualizationTruncated: visualizationTruncated || segments.records.length > MAX_EDGES };
}
