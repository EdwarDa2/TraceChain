'use client';

import Link from 'next/link';
import {
  AlertTriangle, ArrowUpRight, Boxes, Factory, Radio, ShieldCheck,
} from 'lucide-react';
import { DataTable, ErrorState, LoadingState, Panel, StatusBadge } from '../../../components/ui';
import { useApiQuery } from '../../../hooks/use-api';
import type { Activity, DashboardSummary, SystemStatus } from '../../../lib/types';

function activityHref(type: string) {
  if (type === 'RECEPCION' || type === 'PRODUCCION' || type === 'DISTRIBUCION') return '/inventory';
  return '/incidents';
}

export default function DashboardPage() {
  const summary = useApiQuery<DashboardSummary>('/dashboard/summary');
  const activity = useApiQuery<Activity[]>('/dashboard/recent-activity?limit=12');
  const system = useApiQuery<SystemStatus>('/system/sync-status');
  if (summary.isPending || activity.isPending || system.isPending) return <LoadingState rows={5} />;
  if (summary.isError || activity.isError || system.isError) {
    return <ErrorState error={summary.error ?? activity.error ?? system.error} />;
  }
  const data = summary.data;
  const failures = (system.data?.sync ?? []).reduce((total, motor) => total + motor.failed, 0);
  const pending = (system.data?.sync ?? []).reduce((total, motor) => total + motor.pending, 0);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Vista general</h1>
          <p>Estado operativo de la red de lotes y del análisis en curso.</p>
        </div>
        <Link className="button button-primary" href="/traceability">
          <ArrowUpRight aria-hidden /> Explorar trazabilidad
        </Link>
      </header>

      <div className="kpi-strip">
        <Link className="kpi" href="/inventory">
          <span className="kpi-label"><Boxes aria-hidden /> Lotes registrados</span>
          <span className="kpi-value">{data?.totalLots ?? '—'}</span>
        </Link>
        <Link className="kpi" href="/production">
          <span className="kpi-label"><Factory aria-hidden /> Órdenes completadas</span>
          <span className="kpi-value">{data?.totalProductions ?? '—'}</span>
        </Link>
        <Link className="kpi" href="/incidents">
          <span className="kpi-label"><AlertTriangle aria-hidden /> Incidencias activas</span>
          <span className="kpi-value">{data?.activeIncidents ?? '—'}</span>
        </Link>
        <Link className="kpi" href="/inventory">
          <span className="kpi-label"><ShieldCheck aria-hidden /> Lotes bloqueados</span>
          <span className="kpi-value">{data?.blockedLots ?? '—'}</span>
        </Link>
      </div>

      {Number(data?.activeIncidents ?? 0) > 0 ? (
        <div className="incident-banner" style={{ marginTop: 16 }}>
          <div>
            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} aria-hidden /> Hay una investigación activa.
            </strong>{' '}
            <span>Revisa el expediente y consulta el impacto potencial antes de decidir bloqueos.</span>
          </div>
          <div className="toolbar">
            <Link className="button" href="/incidents">Ver incidencias</Link>
            <Link className="button button-primary" href="/traceability">Analizar red</Link>
          </div>
        </div>
      ) : null}

      <div className="workspace" style={{ marginTop: 16 }}>
        <div className="workspace-main">
          <Panel title="Actividad reciente" tight
            actions={<span data-muted>Últimos registros</span>}>
            <DataTable columns={[
              { key: 'type', label: 'Tipo', render: (row) => <StatusBadge status={row.type} /> },
              { key: 'code', label: 'Código' },
              { key: 'description', label: 'Descripción', title: true },
              { key: 'occurredAt', label: 'Fecha',
                render: (row) => <span data-timestamp>
                  {new Date(row.occurredAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                </span> },
              { key: 'actions', label: '', render: (row) =>
                <Link className="button button-quiet" href={activityHref(row.type)} aria-label={`Abrir ${row.code}`}>
                  <ArrowUpRight size={14} aria-hidden />
                </Link> },
            ]} rows={activity.data ?? []} empty="Sin actividad registrada." />
          </Panel>
        </div>
        <div className="workspace-side">
          <Panel title="Estado del sistema">
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                <span data-muted>Sincronización</span>
                <StatusBadge status={system.data?.status ?? 'NO_DISPONIBLE'} />
              </div>
              <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                <span data-muted>Eventos pendientes</span><span data-numeric>{pending}</span>
              </div>
              <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                <span data-muted>Eventos fallidos</span><span data-numeric>{failures}</span>
              </div>
              {(system.data?.sync ?? []).map((motor) => (
                <div className="toolbar" key={motor.destination} style={{ justifyContent: 'space-between' }}>
                  <span>{motor.destination}</span>
                  <span className="sync-dot"><Radio size={12} aria-hidden /> {motor.status}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Acceso rápido">
            <div className="nav" style={{ gap: 2 }}>
              <Link href="/inspections">Inspecciones →</Link>
              <Link href="/incidents">Investigaciones →</Link>
              <Link href="/traceability">Trazabilidad →</Link>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
