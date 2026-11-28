'use client';

import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  DataTable, ErrorState, Field, LoadingState, PageHeader, Pagination,
  Panel, StatusBadge,
} from '../../../components/ui';
import { useApiMutation, useApiQuery } from '../../../hooks/use-api';
import type { Location, Lot, Product } from '../../../lib/types';
import { useAuth } from '../../../providers/auth-provider';

type Order = { id: string; code: string; name: string; producedAt: string;
  inputCount: number; outputCount: number; graphSyncStatus: string };

export default function ProductionPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const limit = 20;
  const orders = useApiQuery<{ data: Order[]; meta: { total: number } }>(`/production-orders?page=${page}&limit=${limit}`);
  const lots = useApiQuery<{ data: Lot[] }>('/lots?limit=100');
  const products = useApiQuery<{ data: Product[] }>('/products?limit=100');
  const locations = useApiQuery<{ data: Location[] }>('/locations?limit=100');
  const create = useApiMutation<Order>();
  const [form, setForm] = useState({ name: '', locationId: '', inputLotId: '',
    inputQuantity: '5.000', outputCode: '', outputProductId: '', outputQuantity: '20.000' });
  const canWrite = user?.role === 'OPERADOR';

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync({ path: '/production-orders', idempotent: true, body: {
      name: form.name, locationId: form.locationId, producedAt: new Date().toISOString(),
      inputs: [{ lotId: form.inputLotId, quantity: form.inputQuantity }],
      outputs: [{ code: form.outputCode, productId: form.outputProductId,
        quantity: form.outputQuantity, expirationDate: null }],
    } });
    setShowForm(false);
  }

  if (orders.isPending || lots.isPending || products.isPending || locations.isPending) {
    return <LoadingState rows={5} />;
  }
  if (orders.isError) return <ErrorState error={orders.error} />;

  return (
    <>
      <PageHeader title="Producción" description="Órdenes completadas, consumos y resultados."
        actions={canWrite ? <button className="button button-primary" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} aria-hidden /> Nueva orden
        </button> : null} />
      <div className="workspace">
        <div className="workspace-main">
          <Panel tight title={`Órdenes · ${orders.data?.meta?.total ?? 0}`}>
            <DataTable columns={[
              { key: 'code', label: 'Orden' },
              { key: 'name', label: 'Nombre', title: true },
              { key: 'inputCount', label: 'Entradas' },
              { key: 'outputCount', label: 'Salidas' },
              { key: 'graphSyncStatus', label: 'Grafo', render: (row) => <StatusBadge status={row.graphSyncStatus} /> },
              { key: 'producedAt', label: 'Fecha', render: (row) =>
                <span data-timestamp>{new Date(row.producedAt).toLocaleString('es-MX')}</span> },
            ]} rows={orders.data?.data ?? []} empty="Sin órdenes registradas." />
            <Pagination page={page} limit={limit} total={orders.data?.meta?.total ?? 0} onChange={setPage} />
          </Panel>
        </div>
        {canWrite && showForm ? (
          <div className="workspace-side">
            <Panel title="Nueva orden">
              <form className="form-grid" onSubmit={submit}>
                <Field label="Nombre"><input required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Ubicación"><select required value={form.locationId}
                  onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {(locations.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></Field>
                <Field label="Lote de entrada"><select required value={form.inputLotId}
                  onChange={(e) => setForm({ ...form, inputLotId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {(lots.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
                </select></Field>
                <Field label="Cantidad consumida"><input required value={form.inputQuantity}
                  onChange={(e) => setForm({ ...form, inputQuantity: e.target.value })} /></Field>
                <Field label="Código de salida"><input required value={form.outputCode}
                  onChange={(e) => setForm({ ...form, outputCode: e.target.value })} /></Field>
                <Field label="Producto de salida"><select required value={form.outputProductId}
                  onChange={(e) => setForm({ ...form, outputProductId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {(products.data?.data ?? []).filter((item) => item.type !== 'MATERIA_PRIMA')
                    .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></Field>
                <Field label="Cantidad producida"><input required value={form.outputQuantity}
                  onChange={(e) => setForm({ ...form, outputQuantity: e.target.value })} /></Field>
                {create.isError ? <ErrorState error={create.error} /> : null}
                <div className="form-actions">
                  <button className="button button-primary" disabled={create.isPending}>Registrar orden</button>
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
