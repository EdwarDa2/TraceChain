'use client';

import { useParams } from 'next/navigation';
import { DataTable, ErrorState, LoadingState, PageHeader, QuantityDisplay, StatusBadge } from '../../../../../components/ui';
import { useApiQuery } from '../../../../../hooks/use-api';
import type { ImpactResult } from '../../../../../lib/types';

export default function ImpactPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const impact = useApiQuery<ImpactResult>(id ? `/incidents/${id}/impact` : null);
  if (impact.isPending) return <LoadingState />;
  if (impact.isError) return <ErrorState error={impact.error} />;
  const data = impact.data;
  return (
    <>
      <PageHeader title="Impacto potencial" description={data?.incident.title}
        actions={<StatusBadge status={data?.status ?? 'NO_DISPONIBLE'} />} />
      <div className="grid grid-4">
        <div className="card"><p data-muted>Lotes afectados</p><p className="metric">{data?.summary.totalAffectedLots}</p></div>
        <div className="card"><p data-muted>Directos / indirectos</p>
          <p className="metric">{data?.summary.directLots} / {data?.summary.indirectLots}</p></div>
        <div className="card"><p data-muted>Destinos</p><p className="metric">{data?.summary.destinationCount}</p></div>
        <div className="card"><p data-muted>Bloqueados</p><p className="metric">{data?.summary.blockedLots}</p></div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 24 }}>
        <section className="card">
          <h2>Lotes y cantidades</h2>
          <div style={{ marginTop: 12 }}>
            <DataTable columns={[
              { key: 'code', label: 'Lote' },
              { key: 'classification', label: 'Clasificación' },
              { key: 'depth', label: 'Nivel' },
              { key: 'physicalQuantity', label: 'Físico', render: (row) =>
                <QuantityDisplay value={row.physicalQuantity} /> },
              { key: 'usableQuantity', label: 'Utilizable', render: (row) =>
                <QuantityDisplay value={row.usableQuantity} /> },
            ]} rows={data?.affectedLots ?? []} />
          </div>
        </section>
        <section className="card">
          <h2>Destinos históricos</h2>
          <div style={{ marginTop: 12 }}>
            <DataTable columns={[
              { key: 'distributionCode', label: 'Distribución' },
              { key: 'locationName', label: 'Ubicación' },
              { key: 'transferredQuantity', label: 'Transferido' },
            ]} rows={data?.destinations.data ?? []} />
          </div>
        </section>
      </div>
      {(data?.metadata.warnings ?? []).length > 0 ? (
        <div className="warning" style={{ marginTop: 24 }}>
          {data?.metadata.warnings.map((warning) => <p key={warning.code}>{warning.message}</p>)}
        </div>
      ) : null}
    </>
  );
}
