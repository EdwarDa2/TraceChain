'use client';

import { useParams } from 'next/navigation';
import {
  DataTable, ErrorState, LoadingState, PageHeader, Panel, QuantityDisplay, StatusBadge,
} from '../../../../../components/ui';
import { GraphViewer, type GraphNode } from '../../../../../components/graph-viewer';
import { useApiQuery } from '../../../../../hooks/use-api';
import type { ImpactResult } from '../../../../../lib/types';

export default function ImpactPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const impact = useApiQuery<ImpactResult>(id ? `/incidents/${id}/impact` : null);
  if (impact.isPending) return <LoadingState rows={5} />;
  if (impact.isError) return <ErrorState error={impact.error} />;
  const data = impact.data;
  return (
    <>
      <PageHeader title="Impacto potencial" description={data?.incident.title}
        actions={<StatusBadge status={data?.status ?? 'NO_DISPONIBLE'} />} />
      <div className="kpi-strip">
        <div className="kpi"><span className="kpi-label">Lotes afectados</span>
          <span className="kpi-value">{data?.summary.totalAffectedLots ?? '—'}</span></div>
        <div className="kpi"><span className="kpi-label">Directos / indirectos</span>
          <span className="kpi-value">{data?.summary.directLots ?? '—'} / {data?.summary.indirectLots ?? '—'}</span></div>
        <div className="kpi"><span className="kpi-label">Destinos</span>
          <span className="kpi-value">{data?.summary.destinationCount ?? '—'}</span></div>
        <div className="kpi"><span className="kpi-label">Bloqueados</span>
          <span className="kpi-value">{data?.summary.blockedLots ?? '—'}</span></div>
      </div>
      <div className="workspace" style={{ marginTop: 16 }}>
        <div className="workspace-main">
          <div className="panel" style={{ overflow: 'hidden' }}>
            <header className="panel-header"><h2>Alcance de la red</h2>
              <span data-muted>{data?.graph.nodes.length} nodos · {data?.graph.edges.length} relaciones</span></header>
            <div className="graph-grid">
              <GraphViewer nodes={data?.graph.nodes as GraphNode[] ?? []}
                edges={data?.graph.edges ?? []}
                rootIds={data?.incident.originLotId ? [data.incident.originLotId] : []} />
              <aside className="graph-detail">
                <h3>Lectura del alcance</h3>
                <p data-muted style={{ marginTop: 8 }}>
                  El impacto es potencial: una dependencia productiva no demuestra contaminación.
                </p>
                {data?.metadata.warnings.map((warning) =>
                  <div className="warning-strip" key={warning.code} style={{ marginTop: 8 }}>{warning.message}</div>)}
              </aside>
            </div>
          </div>
          <Panel title="Lotes y cantidades" tight>
            <DataTable columns={[
              { key: 'code', label: 'Lote' },
              { key: 'classification', label: 'Clasificación' },
              { key: 'depth', label: 'Nivel' },
              { key: 'physicalQuantity', label: 'Físico', render: (row) =>
                <QuantityDisplay value={row.physicalQuantity} /> },
              { key: 'usableQuantity', label: 'Utilizable', render: (row) =>
                <QuantityDisplay value={row.usableQuantity} /> },
            ]} rows={data?.affectedLots ?? []} />
          </Panel>
        </div>
        <div className="workspace-side">
          <Panel title="Destinos históricos" tight>
            <DataTable columns={[
              { key: 'distributionCode', label: 'Distribución' },
              { key: 'locationName', label: 'Ubicación' },
              { key: 'transferredQuantity', label: 'Transferido' },
            ]} rows={data?.destinations.data ?? []} />
          </Panel>
          <Panel title="Calidad" tight>
            <DataTable columns={[
              { key: 'lotId', label: 'Lote' },
              { key: 'nonConforming', label: 'No conformes' },
            ]} rows={data?.quality.data?.byLot ?? []} />
          </Panel>
        </div>
      </div>
    </>
  );
}
