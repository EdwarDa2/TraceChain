'use client';

import { useParams } from 'next/navigation';
import {
  DataTable, ErrorState, LoadingState, PageHeader, Panel, QuantityDisplay, StatusBadge,
} from '../../../../components/ui';
import { useApiQuery, useApiResponse } from '../../../../hooks/use-api';
import type { Block, Lot, Stock } from '../../../../lib/types';

type Details = { lot: Lot; stocks: { data: Stock[] }; quality: { data: {
  totalInspections: number; nonConforming: number } | null };
  incidents: { id: string; code: string; status: string }[] };

export default function LotDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const details = useApiQuery<Details>(id ? `/lots/${id}/details` : null);
  const movements = useApiResponse<{ id: string; type: string; quantity: string;
    beforeQuantity: string; afterQuantity: string; movementAt: string }[]>(
    id ? `/inventory/movements?lotId=${id}&limit=50` : null);
  const blocks = useApiResponse<Block[]>(id ? `/lots/${id}/blocks` : null);
  if (details.isPending || movements.isPending || blocks.isPending) return <LoadingState rows={5} />;
  if (details.isError || movements.isError || blocks.isError) {
    return <ErrorState error={details.error ?? movements.error ?? blocks.error} />;
  }
  const lot = details.data?.lot;
  return (
    <>
      <PageHeader title={lot?.code ?? 'Lote'}
        description={lot ? `${lot.productName} · ${lot.originType}` : undefined}
        actions={lot ? <StatusBadge status={lot.graphSyncStatus} /> : undefined} />
      <div className="kpi-strip">
        <div className="kpi"><span className="kpi-label">Físico</span>
          <span className="kpi-value">{lot ? <QuantityDisplay value={lot.physicalQuantity} unit={lot.unit} /> : '—'}</span></div>
        <div className="kpi"><span className="kpi-label">Utilizable</span>
          <span className="kpi-value">{lot ? <QuantityDisplay value={lot.usableQuantity} unit={lot.unit} /> : '—'}</span></div>
        <div className="kpi"><span className="kpi-label">Inspecciones</span>
          <span className="kpi-value">{details.data?.quality.data?.totalInspections ?? 0}</span></div>
        <div className="kpi"><span className="kpi-label">No conformes</span>
          <span className="kpi-value">{details.data?.quality.data?.nonConforming ?? 0}</span></div>
      </div>
      <div className="workspace" style={{ marginTop: 16 }}>
        <div className="workspace-main">
          <Panel title="Movimientos" tight>
            <DataTable columns={[
              { key: 'type', label: 'Tipo' },
              { key: 'quantity', label: 'Cantidad' },
              { key: 'beforeQuantity', label: 'Anterior' },
              { key: 'afterQuantity', label: 'Posterior' },
              { key: 'movementAt', label: 'Fecha', render: (row) =>
                <span data-timestamp>{new Date(row.movementAt).toLocaleString('es-MX')}</span> },
            ]} rows={movements.data?.data ?? []} />
          </Panel>
          <Panel title="Incidencias del lote" tight>
            <DataTable columns={[
              { key: 'code', label: 'Código' },
              { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
            ]} rows={details.data?.incidents ?? []} empty="Sin incidencias para este lote." />
          </Panel>
        </div>
        <div className="workspace-side">
          <Panel title="Saldos por ubicación" tight>
            <DataTable columns={[
              { key: 'locationName', label: 'Ubicación' },
              { key: 'physicalQuantity', label: 'Físico' },
              { key: 'usableQuantity', label: 'Utilizable' },
            ]} rows={details.data?.stocks.data ?? []} />
          </Panel>
          <Panel title="Bloqueos activos" tight>
            <DataTable columns={[
              { key: 'reason', label: 'Motivo', title: true },
              { key: 'blockedAt', label: 'Fecha', render: (row) =>
                <span data-timestamp>{new Date(row.blockedAt).toLocaleDateString('es-MX')}</span> },
            ]} rows={(blocks.data?.data ?? []).filter((block) => block.active)} />
          </Panel>
        </div>
      </div>
    </>
  );
}
