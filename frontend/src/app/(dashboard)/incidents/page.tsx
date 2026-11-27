'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { DataTable, ErrorState, Field, LoadingState, PageHeader, StatusBadge } from '../../../components/ui';
import { useApiMutation, useApiQuery } from '../../../hooks/use-api';
import type { Incident, Inspection } from '../../../lib/types';
import { useAuth } from '../../../providers/auth-provider';

export default function IncidentsPage() {
  const { user } = useAuth();
  const incidents = useApiQuery<{ data: Incident[] }>('/incidents?limit=100');
  const inspections = useApiQuery<{ data: Inspection[] }>('/inspections?result=NO_CONFORME&limit=100');
  const create = useApiMutation<Incident>();
  const [form, setForm] = useState({ originLotId: '', title: '', type: 'CALIDAD',
    severity: 'MEDIA', description: '', inspectionId: '' });

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

  if (incidents.isPending || inspections.isPending) return <LoadingState />;
  if (incidents.isError) return <ErrorState error={incidents.error} />;
  const nonConforming = [...new Set((inspections.data?.data ?? []).map((item) => item.lotId))];
  return (
    <>
      <PageHeader title="Incidencias" description="Investigaciones abiertas a partir de lotes candidatos." />
      {user?.role === 'ANALISTA_CALIDAD' ? (
        <form className="card form-grid" style={{ marginBottom: 24 }} onSubmit={submit}>
          <Field label="Lote origen"><select required value={form.originLotId}
            onChange={(e) => setForm({ ...form, originLotId: e.target.value })}>
            <option value="">Seleccionar…</option>
            {nonConforming.map((lotId) => <option key={lotId} value={lotId}>{lotId}</option>)}
          </select></Field>
          <Field label="Título"><input required value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Tipo"><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['CALIDAD', 'EMPAQUE', 'ALMACENAMIENTO', 'OTRO'].map((type) => <option key={type}>{type}</option>)}
          </select></Field>
          <Field label="Severidad"><select value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            {['BAJA', 'MEDIA', 'ALTA'].map((value) => <option key={value}>{value}</option>)}
          </select></Field>
          <Field label="Descripción"><textarea required value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Inspección pertinente"><select value={form.inspectionId}
            onChange={(e) => setForm({ ...form, inspectionId: e.target.value })}>
            <option value="">Sin inspección</option>
            {(inspections.data?.data ?? []).map((item) =>
              <option key={item.id} value={item.id}>{item.code}</option>)}
          </select></Field>
          <div className="form-actions">
            <button className="button button-primary" disabled={create.isPending} type="submit">Abrir incidencia</button>
            {create.isError ? <ErrorState error={create.error} /> : null}
          </div>
        </form>
      ) : null}
      <DataTable columns={[
        { key: 'code', label: 'Código', render: (row) => <Link href={`/incidents/${row.id}`}>{row.code}</Link> },
        { key: 'title', label: 'Título' },
        { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
        { key: 'dossierStatus', label: 'Expediente', render: (row) => <StatusBadge status={row.dossierStatus} /> },
        { key: 'severity', label: 'Severidad' },
        { key: 'detectedAt', label: 'Detección',
          render: (row) => <span data-timestamp>{new Date(row.detectedAt).toLocaleString('es-MX')}</span> },
      ]} rows={incidents.data?.data ?? []} empty="No hay incidencias registradas." />
    </>
  );
}
