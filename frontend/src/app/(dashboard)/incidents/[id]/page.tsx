'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { DataTable, ErrorState, Field, LoadingState, PageHeader, StatusBadge } from '../../../../components/ui';
import { useApiMutation, useApiQuery } from '../../../../hooks/use-api';
import type { Block, Incident } from '../../../../lib/types';
import { useAuth } from '../../../../providers/auth-provider';

type DossierView = { dossierStatus: string; status: string; dossier: { description: string;
  version: number; inspectionIds: string[] } | null };

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const { user } = useAuth();
  const incident = useApiQuery<Incident>(id ? `/incidents/${id}` : null);
  const dossier = useApiQuery<DossierView>(id ? `/incidents/${id}/dossier` : null);
  const blocks = useApiQuery<{ data: Block[] }>(id ? `/incidents/${id}/blocks` : null);
  const start = useApiMutation<Incident>();
  const close = useApiMutation<Incident>();
  const block = useApiMutation<Block[]>();
  const release = useApiMutation<{ blockId: string; lotBlocked: boolean }>();
  const [resolution, setResolution] = useState('');
  const [lotIds, setLotIds] = useState('');
  const [reason, setReason] = useState('');

  async function submitStart() { await start.mutateAsync({ path: `/incidents/${id}/start-analysis`, idempotent: true }); }
  async function submitClose(event: FormEvent) {
    event.preventDefault();
    await close.mutateAsync({ path: `/incidents/${id}/close`, idempotent: true, body: { resolution } });
  }
  async function submitBlock(event: FormEvent) {
    event.preventDefault();
    await block.mutateAsync({ path: `/incidents/${id}/blocks`, idempotent: true,
      body: { lotIds: lotIds.split(',').map((item) => item.trim()).filter(Boolean), reason } });
  }

  if (incident.isPending || dossier.isPending || blocks.isPending) return <LoadingState />;
  if (incident.isError || dossier.isError || blocks.isError) {
    return <ErrorState error={incident.error ?? dossier.error ?? blocks.error} />;
  }
  const canWrite = user?.role === 'ANALISTA_CALIDAD';
  return (
    <>
      <PageHeader title={incident.data?.code ?? 'Incidencia'}
        description={incident.data?.title}
        actions={<Link className="button" href={`/incidents/${id}/impact`}>Ver impacto</Link>} />
      <div className="grid grid-2">
        <section className="card">
          <h2>Estado oficial</h2>
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <StatusBadge status={incident.data?.status ?? 'NO_DISPONIBLE'} />
            <p data-muted>Expediente: {dossier.data?.dossierStatus}</p>
            {canWrite && incident.data?.status === 'ABIERTA' ? (
              <button className="button button-primary" disabled={start.isPending} onClick={submitStart}>
                Iniciar análisis
              </button>
            ) : null}
            {canWrite && incident.data?.status === 'EN_ANALISIS' ? (
              <form className="form-grid" onSubmit={submitClose}>
                <Field label="Resolución"><textarea required value={resolution}
                  onChange={(e) => setResolution(e.target.value)} /></Field>
                <button className="button button-primary" disabled={close.isPending}>Cerrar incidencia</button>
              </form>
            ) : null}
          </div>
        </section>
        <section className="card">
          <h2>Expediente</h2>
          <div style={{ marginTop: 12 }}>
            <p>{dossier.data?.dossier?.description ?? 'Documento pendiente de sincronización.'}</p>
            <p data-muted>Versión {dossier.data?.dossier?.version ?? '—'}</p>
            <p data-muted>Inspecciones referenciadas: {dossier.data?.dossier?.inspectionIds.length ?? 0}</p>
          </div>
        </section>
      </div>
      <section className="card" style={{ marginTop: 24 }}>
        <h2>Bloqueos manuales</h2>
        {canWrite ? (
          <form className="form-grid" style={{ marginTop: 12 }} onSubmit={submitBlock}>
            <Field label="Lotes (UUID separados por coma)">
              <input required value={lotIds} onChange={(e) => setLotIds(e.target.value)} />
            </Field>
            <Field label="Justificación"><input required value={reason}
              onChange={(e) => setReason(e.target.value)} /></Field>
            <button className="button button-primary" disabled={block.isPending}>Aplicar bloqueo</button>
          </form>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <DataTable columns={[
            { key: 'lotId', label: 'Lote' },
            { key: 'reason', label: 'Motivo' },
            { key: 'blockedAt', label: 'Fecha',
              render: (row) => <span data-timestamp>{new Date(row.blockedAt).toLocaleString('es-MX')}</span> },
            { key: 'actions', label: 'Acciones', render: (row) => canWrite && row.active ? (
              <button className="button" disabled={release.isPending}
                onClick={() => release.mutate({ path: `/lot-blocks/${row.id}/release`, idempotent: true,
                  body: { reason: 'Retiro decidido por el analista' } })}>Retirar</button>
            ) : null },
          ]} rows={(blocks.data?.data ?? []).filter((item) => item.active)} />
        </div>
      </section>
    </>
  );
}
