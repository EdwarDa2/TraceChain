'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import {
  DataTable, ErrorState, Field, LoadingState, PageHeader, Pagination,
  Panel, QuantityDisplay, SearchInput, StatusBadge,
} from '../../../components/ui';
import { useApiMutation, useApiQuery } from '../../../hooks/use-api';
import type { Location, Lot, Product, Supplier } from '../../../lib/types';
import { useAuth } from '../../../providers/auth-provider';

export default function InventoryPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const limit = 20;
  const lots = useApiQuery<{ data: Lot[]; meta: { total: number } }>(
    `/lots?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
  const suppliers = useApiQuery<{ data: Supplier[] }>('/suppliers?limit=100');
  const products = useApiQuery<{ data: Product[] }>('/products?limit=100');
  const locations = useApiQuery<{ data: Location[] }>('/locations?limit=100');
  const create = useApiMutation<Lot>();
  const [form, setForm] = useState({ code: '', productId: '', supplierId: '',
    locationId: '', quantity: '100.000', receivedAt: '', expirationDate: '' });
  const canWrite = user?.role === 'OPERADOR';

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync({ path: '/lots/receipts', idempotent: true, body: {
      code: form.code, productId: form.productId, supplierId: form.supplierId,
      locationId: form.locationId, quantity: form.quantity,
      receivedAt: form.receivedAt ? new Date(form.receivedAt).toISOString() : new Date().toISOString(),
      expirationDate: form.expirationDate || null,
    } });
    setForm({ code: '', productId: '', supplierId: '', locationId: '',
      quantity: '100.000', receivedAt: '', expirationDate: '' });
    setShowForm(false);
  }

  if (lots.isPending || suppliers.isPending || products.isPending || locations.isPending) {
    return <LoadingState rows={5} />;
  }
  if (lots.isError) return <ErrorState error={lots.error} />;

  return (
    <>
      <PageHeader title="Inventario" description="Lotes, saldos físicos y utilizables por ubicación."
        actions={canWrite ? <button className="button button-primary" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} aria-hidden /> Registrar recepción
        </button> : null} />
      <div className="workspace">
        <div className="workspace-main">
          <Panel tight title={`Lotes · ${lots.data?.meta?.total ?? 0}`}
            actions={<SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }}
              placeholder="Buscar por código de lote" />}>
            <DataTable columns={[
              { key: 'code', label: 'Lote', render: (row) => <Link href={`/inventory/${row.id}`}>{row.code}</Link> },
              { key: 'productName', label: 'Producto', title: true },
              { key: 'originType', label: 'Origen' },
              { key: 'physicalQuantity', label: 'Físico', render: (row) =>
                <QuantityDisplay value={row.physicalQuantity} unit={row.unit} /> },
              { key: 'usableQuantity', label: 'Utilizable', render: (row) =>
                <QuantityDisplay value={row.usableQuantity} unit={row.unit} /> },
              { key: 'blocked', label: 'Estado', render: (row) =>
                <StatusBadge status={row.blocked ? 'BLOQUEADO' : row.expired ? 'CADUCADO' : 'DISPONIBLE'} /> },
              { key: 'graphSyncStatus', label: 'Grafo', render: (row) => <StatusBadge status={row.graphSyncStatus} /> },
            ]} rows={lots.data?.data ?? []} empty="No hay lotes que coincidan con la búsqueda." />
            <Pagination page={page} limit={limit} total={lots.data?.meta?.total ?? 0} onChange={setPage} />
          </Panel>
        </div>
        {canWrite && showForm ? (
          <div className="workspace-side">
            <Panel title="Nueva recepción">
              <form className="form-grid" onSubmit={submit}>
                <Field label="Código de lote"><input required value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
                <Field label="Producto"><select required value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {(products.data?.data ?? []).filter((item) => item.type === 'MATERIA_PRIMA')
                    .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></Field>
                <Field label="Proveedor"><select required value={form.supplierId}
                  onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {(suppliers.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></Field>
                <Field label="Ubicación"><select required value={form.locationId}
                  onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {(locations.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></Field>
                <Field label="Cantidad"><input required value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
                <Field label="Fecha de recepción"><input type="datetime-local" value={form.receivedAt}
                  onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} /></Field>
                <Field label="Caducidad (opcional)"><input type="date" value={form.expirationDate}
                  onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} /></Field>
                {create.isError ? <ErrorState error={create.error} /> : null}
                <div className="form-actions">
                  <button className="button button-primary" disabled={create.isPending}>Guardar recepción</button>
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
