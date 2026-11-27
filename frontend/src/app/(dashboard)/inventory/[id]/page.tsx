'use client';

import { useParams } from 'next/navigation';
import { DataTable, ErrorState, LoadingState, PageHeader, QuantityDisplay, StatusBadge } from '../../../../components/ui';
import { useApiQuery } from '../../../../hooks/use-api';
import type { Block, Lot, Stock } from '../../../../lib/types';

type Details = { lot: Lot; stocks: { data: Stock[] }; quality: { data: { totalInspections: number;
  nonConforming: number } | null }; incidents: { id: string; code: string; status: string }[] };

export default function LotDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const details = useApiQuery<Details>(id ? `/lots/${id}/details` : null);
  const movements = useApiQuery<{ data: { id: string; type: string; quantity: string;
    beforeQuantity: string; afterQuantity: string; movementAt: string }[] }>(
    id ? `/inventory/movements?lotId=${id}&limit=50` : null);
  const blocks = useApiQuery<{ data: Block[] }>(id ? `/lots/${id}/blocks` : null);
  if (details.isPending || movements.isPending || blocks.isPending) return <LoadingState />;
  if (details.isError || movements.isError || blocks.isError) {
    return <ErrorState error={details.error ?? movements.error ?? blocks.error} />;
  }
  const lot = details.data?.lot;
  return (
    <>
      <PageHeader title={lot?.code ?? 'Lote'}
        description={lot ? `${lot.productName} · ${lot.originType}` : undefined}
        actions={lot ? <StatusBadge status={lot.graphSyncStatus} /> : undefined} />
      <div className="grid grid-4">
        <div className="card"><p data-muted>Físico</p>
          <p className="metric">{lot ? <QuantityDisplay value={lot.physicalQuantity} unit={lot.unit} /> : '—'}</p></div>
        <div className="card"><p data-muted>Utilizable</p>
          <p className="metric">{lot ? <QuantityDisplay value={lot.usableQuantity} unit={lot.unit} /> : '—'}</p></div>
        <div className="card"><p data-muted>Inspecciones</p>
          <p className="metric">{details.data?.quality.data?.totalInspections ?? 0}</p></div>
        <div className="card"><p data-muted>No conformes</p>
          <p className="metric">{details.data?.quality.data?.nonConforming ?? 0}</p></div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 24 }}>
        <section className="card">
          <h2>Saldos por ubicación</h2>
          <div style={{ marginTop: 12 }}>
            <DataTable columns={[
              { key: 'locationName', label: 'Ubicación' },
              { key: 'physicalQuantity', label: 'Físico' },
              { key: 'usableQuantity', label: 'Utilizable' },
            ]} rows={details.data?.stocks.data ?? []} />
          </div>
        </section>
        <section className="card">
          <h2>Movimientos</h2>
          <div style={{ marginTop: 12 }}>
            <DataTable columns={[
              { key: 'type', label: 'Tipo' },
              { key: 'quantity', label: 'Cantidad' },
              { key: 'afterQuantity', label: 'Saldo' },
              { key: 'movementAt', label: 'Fecha',
                render: (row) => <span data-timestamp>{new Date(row.movementAt).toLocaleString('es-MX')}</span> },
            ]} rows={movements.data?.data ?? []} />
          </div>
        </section>
      </div>
      <section className="card" style={{ marginTop: 24 }}>
        <h2>Bloqueos activos</h2>
        <div style={{ marginTop: 12 }}>
          <DataTable columns={[
            { key: 'reason', label: 'Motivo' },
            { key: 'blockedAt', label: 'Fecha',
              render: (row) => <span data-timestamp>{new Date(row.blockedAt).toLocaleString('es-MX')}</span> },
          ]} rows={(blocks.data?.data ?? []).filter((block) => block.active)} />
        </div>
      </section>
    </>
  );
}
