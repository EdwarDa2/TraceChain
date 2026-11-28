'use client';

import { Maximize2, Minus, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';

type GraphInstance = {
  zoom(): number;
  zoom(options: { level: number; renderedPosition: { x: number; y: number } }): void;
  fit(elements?: unknown, padding?: number): void;
  destroy(): void;
  on(event: string, selector: string,
    handler: (event: { target: { data(): Record<string, unknown> } }) => void): void;
};
type ElementDefinition = { data: Record<string, unknown> };

export type GraphNode = { id: string; entityId?: string; label: string; type: string };
export type GraphEdge = { id: string; source: string; target: string; type: string;
  quantity?: string | null; unit?: string | null };

export function GraphViewer({ nodes, edges, rootIds = [], onSelect }: {
  nodes: GraphNode[]; edges: GraphEdge[]; rootIds?: string[]; onSelect?: (node: GraphNode) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<GraphInstance | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return;
    (async () => {
      const { default: cytoscape } = await import('cytoscape');
      if (disposed) return;
      const roots = new Set(rootIds);
      const elements: ElementDefinition[] = [
        ...nodes.map((node) => ({
          data: { id: node.id, label: node.label, type: node.type,
            role: roots.has(node.entityId ?? node.id) ? 'origin' :
              node.type === 'Proceso' ? 'process' :
                node.type === 'Distribucion' || node.type === 'Ubicacion' ? 'destination' : 'lot' },
        })),
        ...edges.map((edge) => ({
          data: { id: edge.id, source: edge.source, target: edge.target,
            type: edge.type, label: edge.quantity ? `${edge.quantity} ${edge.unit ?? ''}`.trim() : '' },
        })),
      ];
      const cy = cytoscape({
        container: container as unknown as Record<string, unknown>,
        elements,
        layout: { name: 'breadthfirst', directed: true, spacingFactor: 1.15, padding: 32 },
        style: [
          { selector: 'node', style: {
            'background-color': '#101828', 'label': 'data(label)', 'color': '#101828',
            'font-size': 10, 'font-weight': 600, 'text-valign': 'bottom',
            'text-margin-y': 6, 'text-background-color': '#ffffff',
            'text-background-opacity': 0.9, 'text-background-padding': '2px',
            'width': 26, 'height': 26,
          } },
          { selector: 'node[role = "origin"]', style: {
            'background-color': '#2563eb', 'color': '#2563eb', 'width': 34, 'height': 34,
            'border-width': 2, 'border-color': '#1d4ed8',
          } },
          { selector: 'node[role = "process"]', style: {
            'background-color': '#f1f3f6', 'border-width': 1, 'border-color': '#98a2b3',
            'width': 18, 'height': 18, 'shape': 'round-rectangle',
          } },
          { selector: 'node[role = "destination"]', style: {
            'background-color': '#15803d', 'color': '#15803d', 'shape': 'diamond',
          } },
          { selector: 'edge', style: {
            'width': 1.5, 'line-color': '#d0d5dd', 'target-arrow-color': '#98a2b3',
            'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'arrow-scale': 0.8,
          } },
          { selector: 'edge[type = "GENERA"]', style: { 'line-color': '#2563eb', 'target-arrow-color': '#2563eb' } },
          { selector: 'edge[type = "INCLUIDO_EN"]', style: { 'line-color': '#15803d', 'target-arrow-color': '#15803d' } },
          { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#2563eb' } },
        ],
        minZoom: 0.2, maxZoom: 3,
      }) as GraphInstance;
      cyRef.current = cy;
      cy.on('tap', 'node', (event: { target: { data(): Record<string, unknown> } }) => {
        const data = event.target.data();
        selectRef.current?.({ id: String(data.id), label: String(data.label), type: String(data.type) });
      });
    })();
    return () => { disposed = true; cyRef.current?.destroy(); cyRef.current = null; };
  }, [nodes, edges, rootIds]);

  return (
    <div className="graph-stage">
      <div className="graph-canvas" ref={containerRef} aria-label="Visualización de la red de lotes" role="img" />
      <div className="graph-controls">
        <button aria-label="Acercar" onClick={() => cyRef.current?.zoom({ level: cyRef.current.zoom() * 1.2, renderedPosition: { x: 200, y: 200 } })}><Plus size={14} /></button>
        <button aria-label="Alejar" onClick={() => cyRef.current?.zoom({ level: cyRef.current.zoom() / 1.2, renderedPosition: { x: 200, y: 200 } })}><Minus size={14} /></button>
        <button aria-label="Ajustar vista" onClick={() => cyRef.current?.fit(undefined, 32)}><Maximize2 size={14} /></button>
      </div>
      <div className="graph-legend" aria-label="Leyenda del grafo">
        <div className="legend-row"><span className="legend-dot" style={{ background: 'var(--graph-origin)' }} /> Lote de origen</div>
        <div className="legend-row"><span className="legend-dot" style={{ background: 'var(--graph-descendant)' }} /> Descendiente</div>
        <div className="legend-row"><span className="legend-dot" style={{ background: 'var(--graph-process)' }} /> Proceso</div>
        <div className="legend-row"><span className="legend-dot" style={{ background: 'var(--graph-destination)' }} /> Destino</div>
      </div>
    </div>
  );
}
