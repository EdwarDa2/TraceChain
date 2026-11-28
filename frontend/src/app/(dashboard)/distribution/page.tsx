'use client';

import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  DataTable, ErrorState, Field, LoadingState, PageHeader, Pagination, Panel,
} from '../../../components/ui';
import { useApiMutation, useApiQuery } from '../../../hooks/use-api';
import type { Location, Lot } from '../../../lib/types';
import { useAuth } from '../../../providers/auth-provider';

type Distribution = { id: string; code: string; originLocationId: string;
  destinationLocationId: string; distributedAt: string; itemCount: number };

export default function DistributionPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const limit = 20;
  const distributions = useApiQuery<{ data: Distribution[]; meta: { total: number } }>(
    `/distributions?page=${page}&limit=${limit}`);
  const lots = useApiQuery<{ data: Lot[] }>('/lots?limit=100');
  const locations = useApiQuery<{ data: Location[] }>('/locations?limit=100');
  const create = useApiMutation<Distribution>();
  const [form, setForm] = useState({ originLocationId: '', destinationLocationId: '',
    lotId: '', quantity: '1.000' });
  const canWrite = user?.role === 'OPERADOR';

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync({ path: '/distributions', idempotent: true, body: {
      originLocationId: form.originLocationId, destinationLocationId: form.destinationLocationId,
      distributedAt: new Date().toISOString(), items: [{ lotId: form.lotId, quantity: form.quantity }],
    } });
    setShowForm(false);
  }

  if (distributions.isPending || lots.isPending || locations.isPending) return <LoadingState rows={5} />;
  if (distributions.isError) return <ErrorState error={distributions.error} />;
  const place = (id: string) => locations.data?.data.find((item) => item.id === id)?.code ?? id;

  return (
    <>
      <PageHeader title="Distribución" description="Transferencias completadas entre ubicaciones."
        actions={canWrite ? <button className="button button-primary" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} aria-hidden /> Nueva transferencia
        </button> : null} />
      <div className="workspace">
        <div className="workspace-main">
          <Panel tight title={`Transferencias · ${distributions.data?.meta?.total ?? 0}`}>
            <DataTable columns={[
              { key: 'code', label: 'Distribución' },
              { key: 'originLocationId', label: 'Origen', render: (row) => place(row.originLocationId) },
              { key: 'destinationLocationId', label: 'Destino', render: (row) => place(row.destinationLocationId) },
              { key: 'itemCount', label: 'Ítems' },
              { key: 'distributedAt', label: 'Fecha', render: (row) =>
                <span data-timestamp>{new Date(row.distributedAt).toLocaleString('es-MX')}</span> },
            ]} rows={distributions.data?.data ?? []} empty="Sin distribuciones registradas." />
            <Pagination page={page} limit={limit} total={distributions.data?.meta?.total ?? 0} onChange={setPage} />
          </Panel>
        </div>
        {canWrite && showForm ? (
          <div className="workspace-side">
            <Panel title="Nueva transferencia">
              <form className="form-grid" onSubmit={submit}>
                <Field label="Origen"><select required value={form.originLocationId}
                  onChange={(e) => setForm({ ...form, originLocationId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {(locations.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></Field>
                <Field label="Destino"><select required value={form.destinationLocationId}
                  onChange={(e) => setForm({ ...form, destinationLocationId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {(locations.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></Field>
                <Field label="Lote"><select required value={form.lotId}
                  onChange={(e) => setForm({ ...form, lotId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {(lots.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
                </select></Field>
                <Field label="Cantidad"><input required value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
                {create.isError ? <ErrorState error={create.error} /> : null}
                <div className="form-actions">
                  <button className="button button-primary" disabled={create.isPending}>Registrar</button>
                  <button type="button" className="button button-quiet" onClick={() => setShowForm(false)}>Cancelar</button>
                </div>
              </form>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
