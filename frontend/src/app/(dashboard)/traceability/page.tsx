'use client';

import { useState, type FormEvent } from 'react';
import { DataTable, ErrorState, Field, LoadingState, PageHeader, StatusBadge } from '../../../components/ui';
import { useApiMutation, useApiQuery } from '../../../hooks/use-api';
import type { Lot, TraceResult } from '../../../lib/types';

type Mode = 'FORWARD' | 'BACKWARD' | 'GENEALOGY' | 'COMMON_ORIGINS' | 'PATHS';

export default function TraceabilityPage() {
  const lots = useApiQuery<{ data: Lot[] }>('/lots?limit=100');
  const [mode, setMode] = useState<Mode>('FORWARD');
  const [root, setRoot] = useState('');
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<TraceResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const post = useApiMutation<TraceResult>();

  async function run(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (mode === 'FORWARD' || mode === 'BACKWARD' || mode === 'GENEALOGY') {
        const label = mode.toLowerCase();
        const data = await post.mutateAsync({ path: `/traceability/${root}/${label}` });
        setResult(data as TraceResult);
      } else if (mode === 'COMMON_ORIGINS') {
        const data = await post.mutateAsync({ path: '/traceability/common-origins',
          body: { lotIds: [root, target] } });
        setResult(data as TraceResult);
      } else {
        const data = await post.mutateAsync({ path: '/traceability/paths',
          body: { sourceLotId: root, targetLotId: target, mode: 'SHORTEST' } });
        setResult(data as TraceResult);
      }
    } catch (cause) { setError(cause); }
  }

  if (lots.isPending) return <LoadingState />;
  if (lots.isError) return <ErrorState error={lots.error} />;
  const lotList = lots.data?.data ?? [];
  const name = (id: string) => lotList.find((item) => item.id === id)?.code ?? id;
  return (
    <>
      <PageHeader title="Trazabilidad" description="Recorridos dirigidos, antecedentes comunes y caminos." />
      <form className="card form-grid" style={{ marginBottom: 24 }} onSubmit={run}>
        <Field label="Modalidad"><select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <option value="FORWARD">Adelante</option>
          <option value="BACKWARD">Atrás</option>
          <option value="GENEALOGY">Genealogía</option>
          <option value="COMMON_ORIGINS">Antecedentes comunes</option>
          <option value="PATHS">Caminos</option>
        </select></Field>
        <Field label="Lote origen"><select required value={root} onChange={(e) => setRoot(e.target.value)}>
          <option value="">Seleccionar…</option>
          {lotList.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
        </select></Field>
        {mode === 'COMMON_ORIGINS' || mode === 'PATHS' ? (
          <Field label="Segundo lote"><select required value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Seleccionar…</option>
            {lotList.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
          </select></Field>
        ) : null}
        <div className="form-actions"><button className="button button-primary" disabled={post.isPending}>Consultar</button></div>
      </form>
      {error ? <ErrorState error={error} /> : null}
      {result ? (
        <div className="trace-result">
          <PageHeader title="Resultado" description={result.queryType}
            actions={<StatusBadge status={result.status} />} />
          <div className="grid grid-4">
            <div className="card"><p data-muted>Únicos</p><p className="metric">{Object.values(result.summary)[5] ?? '—'}</p></div>
            <div className="card"><p data-muted>Directos</p><p className="metric">{result.summary.directLots ?? '—'}</p></div>
            <div className="card"><p data-muted>Indirectos</p><p className="metric">{result.summary.indirectLots ?? '—'}</p></div>
            <div className="card"><p data-muted>Caminos</p><p className="metric">{result.summary.pathsReturned ?? '—'}</p></div>
          </div>
          <section className="card">
            <h2>Lotes</h2>
            <div style={{ marginTop: 12 }}>
              <DataTable columns={[
                { key: 'code', label: 'Lote' },
                { key: 'depth', label: 'Nivel' },
                { key: 'direction', label: 'Dirección' },
              ]} rows={result.lots.map((item) => ({ ...item, code: name(item.lotId) }))} />
            </div>
          </section>
          {result.paths.length > 0 ? (
            <section className="card">
              <h2>Caminos</h2>
              <div style={{ marginTop: 12 }}>
                <DataTable columns={[
                  { key: 'depth', label: 'Transformaciones' },
                  { key: 'nodeIds', label: 'Nodos', render: (row) => row.nodeIds.map(name).join(' → ') },
                ]} rows={result.paths} />
              </div>
            </section>
          ) : null}
          <section className="card">
            <h2>Alternativa textual del grafo</h2>
            <div style={{ marginTop: 12 }}>
              <p data-muted>{result.graph.nodes.length} nodos · {result.graph.edges.length} relaciones reales</p>
              <DataTable columns={[
                { key: 'type', label: 'Tipo' },
                { key: 'label', label: 'Etiqueta' },
              ]} rows={result.graph.nodes} />
            </div>
          </section>
          {result.metadata.warnings.length > 0 ? (
            <div className="warning">
              {result.metadata.warnings.map((warning) => <p key={warning.code}>{warning.message}</p>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
