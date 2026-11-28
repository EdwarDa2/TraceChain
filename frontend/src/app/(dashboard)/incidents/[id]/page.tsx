'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { LotLabel } from '../../../../components/lot-label';
import {
  DataTable, ErrorState, Field, LoadingState, PageHeader, Panel, StatusBadge,
} from '../../../../components/ui';
import { useApiMutation, useApiQuery, useApiResponse } from '../../../../hooks/use-api';
import type { Block, ImpactResult, Incident, Lot } from '../../../../lib/types';
import { useAuth } from '../../../../providers/auth-provider';

type DossierView = { dossierStatus: string; status: string; dossier: {
  description: string; version: number; inspectionIds: string[] } | null };

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const { user } = useAuth();
  const incident = useApiQuery<Incident>(id ? `/incidents/${id}` : null);
  const dossier = useApiQuery<DossierView>(id ? `/incidents/${id}/dossier` : null);
  const blocks = useApiResponse<Block[]>(id ? `/incidents/${id}/blocks` : null);
  const lots = useApiResponse<Lot[]>('/lots?limit=100');
  const impact = useApiQuery<ImpactResult>(id ? `/incidents/${id}/impact` : null);
  const start = useApiMutation<Incident>();
  const close = useApiMutation<Incident>();
  const block = useApiMutation<Block[]>();
  const release = useApiMutation<{ blockId: string; lotBlocked: boolean }>();
  const [resolution, setResolution] = useState('');
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');

  async function submitClose(event: FormEvent) {
    event.preventDefault();
    await close.mutateAsync({ path: `/incidents/${id}/close`, idempotent: true, body: { resolution } });
  }
  async function submitBlock(event: FormEvent) {
    event.preventDefault();
    await block.mutateAsync({ path: `/incidents/${id}/blocks`, idempotent: true,
      body: { lotIds: [...selectedLots], reason } });
  }

  if (incident.isPending || dossier.isPending || blocks.isPending || lots.isPending) return <LoadingState rows={5} />;
  if (incident.isError || dossier.isError || blocks.isError || lots.isError) {
    return <ErrorState error={incident.error ?? dossier.error ?? blocks.error ?? lots.error} />;
  }
  const canWrite = user?.role === 'ANALISTA_CALIDAD';
  const candidateIds = [...new Set([
    incident.data?.originLotId,
    ...(impact.data?.affectedLots ?? []).map((item) => item.lotId),
  ].filter((value): value is string => Boolean(value)))].slice(0, 100);
  return (
    <>
      <PageHeader title={incident.data?.code ?? 'Incidencia'} description={incident.data?.title}
        actions={<Link className="button button-primary" href={`/incidents/${id}/impact`}>Ver impacto</Link>} />
      <div className="workspace">
        <div className="workspace-main">
          <Panel title="Estado de la investigación" tight>
            <div className="toolbar" style={{ padding: 12, justifyContent: 'space-between' }}>
              <div className="toolbar"><StatusBadge status={incident.data?.status ?? 'NO_DISPONIBLE'} />
                <StatusBadge status={incident.data?.dossierStatus ?? 'PENDIENTE'} /></div>
              <span data-muted>Detectada {incident.data?.detectedAt
                ? new Date(incident.data.detectedAt).toLocaleDateString('es-MX') : '—'}</span>
            </div>
            <div className="panel-body">
              <p>{incident.data?.resolution ?? 'Sin resolución registrada.'}</p>
            </div>
          </Panel>
          <Panel title="Expediente" tight>
            <div className="panel-body">
              <p>{dossier.data?.dossier?.description ?? 'Expediente pendiente de sincronización.'}</p>
              <p data-muted style={{ marginTop: 8 }}>
                Versión {dossier.data?.dossier?.version ?? '—'} ·
                {' '}{dossier.data?.dossier?.inspectionIds.length ?? 0} inspecciones referenciadas
              </p>
            </div>
          </Panel>
          <Panel title="Bloqueos manuales" tight>
            <DataTable columns={[
              { key: 'lotId', label: 'Lote', render: (row) => <LotLabel lotId={row.lotId} /> },
              { key: 'reason', label: 'Motivo', title: true },
              { key: 'blockedAt', label: 'Fecha', render: (row) =>
                <span data-timestamp>{new Date(row.blockedAt).toLocaleDateString('es-MX')}</span> },
              { key: 'actions', label: '', render: (row) => canWrite && row.active ? (
                <button className="button button-quiet" disabled={release.isPending}
                  onClick={() => release.mutate({ path: `/lot-blocks/${row.id}/release`, idempotent: true,
                    body: { reason: 'Retiro decidido por el analista' } })}>Retirar</button>
              ) : null },
            ]} rows={(blocks.data?.data ?? []).filter((block) => block.active)} />
          </Panel>
        </div>
        {canWrite ? (
          <div className="workspace-side">
            {incident.data?.status === 'ABIERTA' ? (
              <Panel title="Iniciar análisis">
                <button className="button button-primary" disabled={start.isPending}
                  onClick={() => start.mutate({ path: `/incidents/${id}/start-analysis`, idempotent: true })}>
                  Iniciar análisis
                </button>
              </Panel>
            ) : null}
            {incident.data?.status === 'EN_ANALISIS' ? (
              <Panel title="Cerrar investigación">
                <form className="form-grid" onSubmit={submitClose}>
                  <Field label="Resolución"><textarea required value={resolution}
                    onChange={(event) => setResolution(event.target.value)} /></Field>
                  <button className="button button-primary" disabled={close.isPending}>Cerrar</button>
                </form>
              </Panel>
            ) : null}
            <Panel title="Aplicar bloqueo">
              <form className="form-grid" onSubmit={submitBlock}>
                <Field label={`Lotes verificados (${selectedLots.size})`}>
                  <div className="lot-picker">
                    {candidateIds.map((identifier) => {
                      const lot = lots.data?.data.find((item) => item.id === identifier);
                      return (
                        <label key={identifier}>
                          <input type="checkbox" checked={selectedLots.has(identifier)}
                            onChange={() => setSelectedLots((current) => {
                              const next = new Set(current);
                              if (next.has(identifier)) next.delete(identifier); else next.add(identifier);
                              return next;
                            })} />
                          <span>{`${lot?.code ?? identifier.slice(0, 8)} · ${lot?.productName ?? 'lote'}`}</span>
                        </label>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Justificación">
                  <input required value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
                <p data-muted className="critical-note">El bloqueo es manual y requiere justificación. Una dependencia productiva no demuestra contaminación.</p>
                <button className="button button-primary" disabled={block.isPending || selectedLots.size === 0}>Bloquear</button>
              </form>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
