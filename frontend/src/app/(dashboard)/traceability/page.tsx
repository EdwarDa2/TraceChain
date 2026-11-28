'use client';

import { GitBranch, Network, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  DataTable, ErrorState, LoadingState, PageHeader, Panel, StatusBadge,
} from '../../../components/ui';
import { GraphViewer, type GraphNode } from '../../../components/graph-viewer';
import { useApiMutation, useApiResponse } from '../../../hooks/use-api';
import { statusLabel } from '../../../lib/labels';
import type { Lot, TraceResult } from '../../../lib/types';

type Mode = 'FORWARD' | 'BACKWARD' | 'GENEALOGY' | 'COMMON_ORIGINS' | 'PATHS';
const MODES: { value: Mode; label: string }[] = [
  { value: 'FORWARD', label: 'Adelante' }, { value: 'BACKWARD', label: 'Atrás' },
  { value: 'GENEALOGY', label: 'Genealogía' }, { value: 'COMMON_ORIGINS', label: 'Comunes' },
  { value: 'PATHS', label: 'Caminos' },
];

export default function TraceabilityPage() {
  const lots = useApiResponse<Lot[]>('/lots?limit=100');
  const run = useApiMutation<TraceResult>();
  const [mode, setMode] = useState<Mode>('FORWARD');
  const [root, setRoot] = useState('');
  const [target, setTarget] = useState('');
  const [depth, setDepth] = useState(10);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('mode');
    if (requested && MODES.some((item) => item.value === requested)) {
      setMode(requested as Mode);
    }
    const identifiers = (params.get('lotIds') ?? '').split(',').filter(Boolean).slice(0, 2);
    if (identifiers.length > 0) setRoot(identifiers[0]);
    if (identifiers.length > 1) setTarget(identifiers[1]);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const query = `?maxDepth=${depth}`;
      const data = mode === 'FORWARD' || mode === 'BACKWARD' || mode === 'GENEALOGY'
        ? await run.mutateAsync({ path: `/traceability/${root}/${mode.toLowerCase()}${query}`, method: 'GET' })
        : mode === 'COMMON_ORIGINS'
          ? await run.mutateAsync({ path: '/traceability/common-origins',
            body: { lotIds: [root, target], maxDepth: depth } })
          : await run.mutateAsync({ path: '/traceability/paths',
            body: { sourceLotId: root, targetLotId: target, mode: 'SHORTEST', maxDepth: depth } });
      setResult(data);
      setSelected(null);
    } catch (cause) { setError(cause); }
  }

  if (lots.isPending) return <LoadingState rows={4} />;
  if (lots.isError) return <ErrorState error={lots.error} />;
  const lotList = lots.data?.data ?? [];
  const name = (id: string) => lotList.find((item) => item.id === id)?.code ?? id.slice(0, 8);

  return (
    <>
      <PageHeader title="Trazabilidad" description="Exploración dirigida de dependencias productivas."
        actions={<span className="badge badge-neutral"><Network size={13} aria-hidden /> Espacio de análisis</span>} />
      <Panel tight>
        <form className="trace-toolbar" onSubmit={submit}>
          <div className="mode-pills" role="group" aria-label="Modalidad de trazabilidad">
            {MODES.map((item) => <button type="button" key={item.value}
              data-active={mode === item.value} onClick={() => setMode(item.value)}>{item.label}</button>)}
          </div>
          <label className="field" style={{ minWidth: 180 }}>
            <span>Lote origen</span>
            <select required value={root} onChange={(e) => setRoot(e.target.value)}>
              <option value="">Seleccionar…</option>
              {lotList.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
            </select>
          </label>
          {(mode === 'COMMON_ORIGINS' || mode === 'PATHS') ? (
            <label className="field" style={{ minWidth: 180 }}>
              <span>Segundo lote</span>
              <select required value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Seleccionar…</option>
                {lotList.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
              </select>
            </label>
          ) : null}
          <label className="field" style={{ minWidth: 110 }}>
            <span>Profundidad</span>
            <input type="number" min={1} max={20} value={depth}
              onChange={(e) => setDepth(Number(e.target.value))} />
          </label>
          <button className="button button-primary" disabled={run.isPending} type="submit">
            <Search size={14} aria-hidden /> Consultar
          </button>
        </form>
      </Panel>

      {error ? <ErrorState error={error} /> : null}

      {result ? (
        <div className="workspace" style={{ marginTop: 16 }}>
          <div className="workspace-main">
            <div className="panel" style={{ overflow: 'hidden' }}>
              <header className="panel-header">
                <div className="toolbar"><GitBranch size={15} aria-hidden />
                  <strong>{statusLabel(result.queryType)}</strong>
                  <StatusBadge status={result.status} />
                </div>
                <span data-muted>{result.metadata.durationMs.toFixed(0)} ms</span>
              </header>
              <div className="graph-grid">
                <GraphViewer nodes={result.graph.nodes as GraphNode[]} edges={result.graph.edges}
                  rootIds={[root, target].filter(Boolean)} onSelect={setSelected} />
                <aside className="graph-detail">
                  <h3>Detalle del nodo</h3>
                  <p data-muted style={{ marginTop: 8 }}>
                    {selected ? `${selected.type}: ${selected.label}` : 'Selecciona un nodo del grafo.'}
                  </p>
                  <div className="scope-bar" style={{ marginTop: 16 }}>
                    <i style={{ width: `${Math.min(100, result.lots.length * 2)}%` }} />
                  </div>
                  <p data-muted style={{ marginTop: 6 }}>Alcance potencial verificado</p>
                  <p data-muted className="critical-note">Un origen común es una hipótesis, no una causa. La dependencia productiva no demuestra contaminación.</p>
                  {result.metadata.warnings.map((warning) =>
                    <div className="warning-strip" key={warning.code} style={{ marginTop: 8 }}>{warning.message}</div>)}
                </aside>
              </div>
            </div>
          </div>
          <div className="workspace-side">
            <Panel title="Resultados" tight>
              <DataTable columns={[
                { key: 'code', label: 'Lote' },
                { key: 'depth', label: 'Nivel' },
                { key: 'direction', label: 'Dirección' },
              ]} rows={result.lots.map((item) => ({ ...item, code: name(item.lotId) }))}
                empty="Sin lotes en el alcance consultado." />
            </Panel>
            {result.paths.length > 0 ? (
              <Panel title="Caminos" tight>
                <div className="result-list">
                  {result.paths.map((path, index) => (
                    <div className="result-row" key={index}>
                      <span>{path.nodeIds.map(name).join(' → ')}</span>
                      <strong>{path.depth}</strong>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="state" style={{ marginTop: 16 }}>
          El grafo aparecerá aquí después de ejecutar una consulta.
        </div>
      )}
    </>
  );
}
