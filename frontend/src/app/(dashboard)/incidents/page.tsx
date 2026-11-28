'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  DataTable, ErrorState, Field, LoadingState, PageHeader, Pagination,
  Panel, StatusBadge,
} from '../../../components/ui';
import { useApiMutation, useApiResponse } from '../../../hooks/use-api';
import type { Incident, Inspection } from '../../../lib/types';
import { useAuth } from '../../../providers/auth-provider';

export default function IncidentsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ originLotId: '', title: '', type: 'CALIDAD',
    severity: 'MEDIA', description: '', inspectionId: '' });
  const limit = 20;
  const incidents = useApiResponse<Incident[]>(
    `/incidents?page=${page}&limit=${limit}${status ? `&status=${status}` : ''}`);
  const inspections = useApiResponse<Inspection[]>('/inspections?result=NO_CONFORME&limit=100');
  const create = useApiMutation<Incident>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync({ path: '/incidents', idempotent: true, body: {
      originLotId: form.originLotId, title: form.title, type: form.type,
      severity: form.severity, detectedAt: new Date().toISOString(),
      description: form.description,
      inspectionIds: form.inspectionId ? [form.inspectionId] : [],
      findings: [], evidence: [],
    } });
  }

  if (incidents.isPending || inspections.isPending) return <LoadingState rows={4} />;
  if (incidents.isError) return <ErrorState error={incidents.error} />;
  const nonConforming = [...new Set((inspections.data?.data ?? []).map((item) => item.lotId))];

  return (
    <>
      <PageHeader title="Incidencias" description="Investigaciones, severidad y expedientes."
        actions={<span className="badge badge-neutral"><AlertTriangle size={13} aria-hidden /> Flujo de análisis</span>} />
      <div className="workspace">
        <div className="workspace-main">
          <Panel tight title={`Investigaciones · ${incidents.data?.meta?.total ?? 0}`}
            actions={<select value={status} aria-label="Filtrar por estado"
              onChange={(event) => { setStatus(event.target.value); setPage(1); }} style={{ width: 140 }}>
              <option value="">Todos</option><option value="ABIERTA">Abiertas</option>
              <option value="EN_ANALISIS">En análisis</option><option value="CERRADA">Cerradas</option>
            </select>}>
            <DataTable columns={[
              { key: 'code', label: 'Incidencia', render: (row) =>
                <Link href={`/incidents/${row.id}`}>{row.code}</Link> },
              { key: 'title', label: 'Título', title: true },
              { key: 'severity', label: 'Severidad', render: (row) => <StatusBadge status={row.severity} /> },
              { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'dossierStatus', label: 'Expediente', render: (row) => <StatusBadge status={row.dossierStatus} /> },
              { key: 'detectedAt', label: 'Detección', render: (row) =>
                <span data-timestamp>{new Date(row.detectedAt).toLocaleDateString('es-MX')}</span> },
            ]} rows={incidents.data?.data ?? []} empty="No hay incidencias con este estado." />
            <Pagination page={page} limit={limit} total={incidents.data?.meta?.total ?? 0} onChange={setPage} />
          </Panel>
        </div>
        {user?.role === 'ANALISTA_CALIDAD' ? (
          <div className="workspace-side">
            <Panel title="Abrir investigación">
              <form className="form-grid" onSubmit={submit}>
                <Field label="Lote origen"><select required value={form.originLotId}
                  onChange={(e) => setForm({ ...form, originLotId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {nonConforming.map((lotId) => <option key={lotId} value={lotId}>{lotId}</option>)}
                </select></Field>
                <Field label="Título"><input required value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
                <div className="form-row">
                  <Field label="Tipo"><select value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {['CALIDAD', 'EMPAQUE', 'ALMACENAMIENTO', 'OTRO'].map((type) => <option key={type}>{type}</option>)}
                  </select></Field>
                  <Field label="Severidad"><select value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                    {['BAJA', 'MEDIA', 'ALTA'].map((value) => <option key={value}>{value}</option>)}
                  </select></Field>
                </div>
                <Field label="Descripción"><textarea required value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                <Field label="Inspección pertinente"><select value={form.inspectionId}
                  onChange={(e) => setForm({ ...form, inspectionId: e.target.value })}>
                  <option value="">Sin inspección</option>
                  {(inspections.data?.data ?? []).map((item) =>
                    <option key={item.id} value={item.id}>{item.code}</option>)}
                </select></Field>
                {create.isError ? <ErrorState error={create.error} /> : null}
                <button className="button button-primary" disabled={create.isPending}>Abrir incidencia</button>
              </form>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
