'use client';

import Link from 'next/link';
import {
  AlertTriangle, ArrowUpRight, Boxes, ClipboardCheck, CircleHelp, Factory, Network,
  Radio, ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { GlassScene } from '../../../components/glass-scene';
import { DataTable, ErrorState, LoadingState, Panel, StatusBadge } from '../../../components/ui';
import { useApiQuery } from '../../../hooks/use-api';
import { statusLabel } from '../../../lib/labels';
import type { Activity, DashboardSummary, SystemStatus } from '../../../lib/types';

function activityHref(type: string) {
  if (type === 'RECEPCION' || type === 'PRODUCCION' || type === 'DISTRIBUCION') return '/inventory';
  return '/incidents';
}

const METRICS = [
  { label: 'Lotes registrados', key: 'totalLots', href: '/inventory',
    icon: Boxes, tone: '' },
  { label: 'Órdenes completadas', key: 'totalProductions', href: '/production',
    icon: Factory, tone: 'orange' },
  { label: 'Incidencias activas', key: 'activeIncidents', href: '/incidents',
    icon: AlertTriangle, tone: 'red' },
  { label: 'Lotes bloqueados', key: 'blockedLots', href: '/inventory',
    icon: ShieldCheck, tone: 'green' },
] as const;

export default function DashboardPage() {
  const [glossaryOpen, setGlossaryOpen] = useState(false);
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
  const degraded = pending > 0 || failures > 0 ||
    (system.data?.sync ?? []).some((motor) => motor.status !== 'SYNCHRONIZED');
  const incident = (activity.data ?? []).find((item) => item.type === 'INCIDENCIA');
  const impactHref = incident ? `/incidents/${incident.entityId}/impact` : '/incidents';
  const activityCounts = (activity.data ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});
  const maxCount = Math.max(1, ...Object.values(activityCounts));
  const toneFor = (type: string) => type === 'INCIDENCIA' ? 'danger'
    : type === 'RECEPCION' ? 'warning' : undefined;

  return (
    <>
      <header className="page-header dashboard-hero">
        <GlassScene />
        <div>
          <h1>Vista general</h1>
          <p>Estado operativo de la red de lotes y del análisis en curso.</p>
        </div>
        <div className="topbar-actions">
          <StatusBadge status={degraded ? 'DEGRADED' : 'AVAILABLE'} />
          <div className="glossary">
            <button className="icon-button" aria-label="Glosario de estados"
              aria-expanded={glossaryOpen} onClick={() => setGlossaryOpen((open) => !open)}>
              <CircleHelp size={15} aria-hidden />
            </button>
            {glossaryOpen ? (
              <div className="glossary-panel" role="note">
                <strong>Qué significa cada estado</strong>
                <span><b>Completo:</b> alcance verificado sin truncamiento.</span>
                <span><b>Parcial:</b> hay límites de profundidad o proyección pendiente.</span>
                <span><b>No disponible:</b> la fuente requerida no respondió; no es un resultado vacío.</span>
                <span><b>Pendiente / Sincronizado:</b> estado del expediente documental.</span>
                <span><b>Disponible / Degradado:</b> salud de la sincronización entre motores.</span>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="metric-grid">
        {METRICS.map((metric) => {
          const Icon = metric.icon;
          return (
            <Link className="metric-card" href={metric.href} key={metric.key}>
              <div className="metric-card-top">
                <span className={`icon-tile ${metric.tone}`}><Icon size={16} aria-hidden /></span>
                <ArrowUpRight size={14} aria-hidden />
              </div>
              <div>
                <p className="metric-label">{metric.label}</p>
                <p className="metric-value">{data?.[metric.key] ?? '—'}</p>
              </div>
              <div className="metric-footer">
                <span>Ver módulo</span><span>→</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="workspace">
        <div className="workspace-main">
          <Panel title="Actividad por tipo" actions={<span data-muted>Últimos 12 registros</span>}>
            <div className="mini-bars">
              {Object.entries(activityCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div className="mini-bar-row" key={type} data-tone={toneFor(type)}>
                  <StatusBadge status={type} />
                  <div className="mini-bar-track">
                    <div className="mini-bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span data-numeric>{count}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Actividad reciente" tight
            actions={<span data-muted>Últimos registros</span>}>
            <DataTable columns={[
              { key: 'type', label: 'Tipo', render: (row) => <StatusBadge status={row.type} /> },
              { key: 'code', label: 'Código' },
              { key: 'description', label: 'Descripción', title: true },
              { key: 'occurredAt', label: 'Fecha', render: (row) =>
                <span data-timestamp>
                  {new Date(row.occurredAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                </span> },
              { key: 'actions', label: '', srLabel: 'Acciones', render: (row) =>
                <Link className="button button-quiet" href={activityHref(row.type)}
                  aria-label={`Abrir ${row.code}`}><ArrowUpRight size={14} aria-hidden /></Link> },
            ]} rows={activity.data ?? []} empty="Sin actividad registrada." />
          </Panel>
          <Panel title="Accesos rápidos">
            <div className="quick-grid">
              <Link href="/inspections">Inspecciones <ArrowUpRight size={14} aria-hidden /></Link>
              <Link href="/incidents">Investigaciones <ArrowUpRight size={14} aria-hidden /></Link>
              <Link href="/traceability">Trazabilidad <ArrowUpRight size={14} aria-hidden /></Link>
            </div>
          </Panel>
        </div>
        <div className="workspace-side">
          <div className="insight-card">
            <h2><Network size={15} aria-hidden /> Investigación activa</h2>
            <p data-muted>
              {Number(data?.activeIncidents ?? 0) > 0
                ? 'Revisa el expediente y consulta el impacto potencial antes de decidir bloqueos.'
                : 'No hay investigaciones activas en este momento.'}
            </p>
            <div className="toolbar">
              <Link className="button button-primary" href={impactHref}>Ver impacto</Link>
              <Link className="button" href="/incidents">Incidencias</Link>
            </div>
          </div>
          <Panel title="Estado del sistema">
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                <span data-muted>Sincronización</span>
                <StatusBadge status={degraded ? 'DEGRADED' : system.data?.status ?? 'NO_DISPONIBLE'} />
              </div>
              <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                <span data-muted><ClipboardCheck size={12} aria-hidden /> Eventos pendientes</span>
                <span data-numeric>{pending}</span>
              </div>
              <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                <span data-muted><Radio size={12} aria-hidden /> Eventos fallidos</span>
                <span data-numeric>{failures}</span>
              </div>
              {(system.data?.sync ?? []).map((motor) => (
                <div className="toolbar" key={motor.destination} style={{ justifyContent: 'space-between' }}>
                  <span>{motor.destination}</span>
                  <span className="sync-dot"><Radio size={12} aria-hidden /> {statusLabel(motor.status)}</span>
                </div>
              ))}
              {degraded ? (
                <p data-muted className="critical-note">
                  {pending} eventos pendientes y {failures} fallidos: el impacto potencial puede estar desactualizado hasta que la sincronización termine.
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
