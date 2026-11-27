'use client';

import Link from 'next/link';
import { DataTable, ErrorState, LoadingState, PageHeader, StatusBadge, SyncStatus } from '../../../components/ui';
import { useApiQuery } from '../../../hooks/use-api';
import type { Activity, DashboardSummary, SystemStatus } from '../../../lib/types';

export default function DashboardPage() {
  const summary = useApiQuery<DashboardSummary>('/dashboard/summary');
  const activity = useApiQuery<Activity[]>('/dashboard/recent-activity?limit=10');
  const system = useApiQuery<SystemStatus>('/system/sync-status');
  if (summary.isPending || activity.isPending || system.isPending) return <LoadingState />;
  if (summary.isError || activity.isError || system.isError) {
    return <ErrorState error={summary.error ?? activity.error ?? system.error} />;
  }
  const data = summary.data;
  return (
    <>
      <PageHeader title="Dashboard" description="Estado operativo y actividad reciente." />
      <div className="grid grid-4">
        <div className="card"><p data-muted>Lotes</p><p className="metric">{data?.totalLots}</p></div>
        <div className="card"><p data-muted>Producciones</p><p className="metric">{data?.totalProductions}</p></div>
        <div className="card"><p data-muted>Incidencias activas</p><p className="metric">{data?.activeIncidents}</p></div>
        <div className="card"><p data-muted>Lotes bloqueados</p><p className="metric">{data?.blockedLots}</p></div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 24 }}>
        <section className="card">
          <h2>Actividad reciente</h2>
          <div style={{ marginTop: 12 }}>
            <DataTable columns={[
              { key: 'type', label: 'Tipo' },
              { key: 'code', label: 'Código' },
              { key: 'description', label: 'Descripción' },
              { key: 'occurredAt', label: 'Fecha',
                render: (row) => <span data-timestamp>{new Date(row.occurredAt).toLocaleString('es-MX')}</span> },
            ]} rows={activity.data ?? []} empty="Sin actividad registrada." />
          </div>
        </section>
        <section className="card">
          <h2>Estado del sistema</h2>
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <div><StatusBadge status={system.data?.status ?? 'NO_DISPONIBLE'} /></div>
            {(system.data?.sync ?? []).map((motor) => (
              <div key={motor.destination} className="toolbar" style={{ justifyContent: 'space-between' }}>
                <span>{motor.destination}</span>
                <div className="toolbar">
                  <span data-numeric>{motor.pending} pendientes</span>
                  <span data-numeric>{motor.failed} fallidos</span>
                  <SyncStatus status={motor.status} />
                </div>
              </div>
            ))}
            <Link href="/traceability">Abrir explorador de trazabilidad</Link>
          </div>
        </section>
      </div>
    </>
  );
}
