'use client';

import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  DataTable, ErrorState, Field, LoadingState, PageHeader,
  Pagination, Panel, SearchInput, StatusBadge,
} from '../../components/ui';
import { useApiMutation, useApiResponse } from '../../hooks/use-api';
import type { Location, Product, Supplier } from '../../lib/types';
import { useAuth } from '../../providers/auth-provider';

type Item = Supplier | Product | Location;
type Config = {
  title: string; description: string;
  path: 'suppliers' | 'products' | 'locations';
  fields: { key: string; label: string; options?: string[] }[];
};

export function CatalogPage({ config }: { config: Config }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const limit = 20;
  const query = useApiResponse<Item[]>(
    `/${config.path}?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}` +
    (active ? `&active=${active}` : ''));
  const create = useApiMutation<Item>();
  const status = useApiMutation<Item>();
  const canWrite = user?.role === 'OPERADOR';

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync({ path: `/${config.path}`, body: form });
    setForm({});
    setShowForm(false);
  }

  if (query.isPending) return <LoadingState rows={4} />;
  if (query.isError) return <ErrorState error={query.error} />;

  return (
    <>
      <PageHeader title={config.title} description={config.description}
        actions={canWrite ? <button className="button button-primary"
          onClick={() => setShowForm((open) => !open)}><Plus size={14} aria-hidden /> Nuevo registro</button> : null} />
      <div className="workspace">
        <div className="workspace-main">
          <Panel tight
            title={`Registros · ${query.data?.meta?.total ?? 0}`}
            actions={<><SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }}
              placeholder={`Buscar en ${config.title.toLowerCase()}`} />
              <select value={active} aria-label="Filtrar por estado"
                onChange={(event) => { setActive(event.target.value); setPage(1); }} style={{ width: 130 }}>
                <option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option>
              </select></>}>
            <DataTable columns={[
              { key: 'code', label: 'Código' },
              { key: 'name', label: 'Nombre', title: true },
              { key: 'type', label: 'Tipo / unidad', render: (row) => {
                const item = row as Item & { type?: string; unit?: string };
                return <>{item.type}{item.unit ? ` · ${item.unit}` : ''}</>;
              } },
              { key: 'active', label: 'Estado', render: (row) =>
                <StatusBadge status={row.active ? 'ACTIVO' : 'INACTIVO'} /> },
              ...(canWrite ? [{ key: 'actions', label: '', render: (row: Item) =>
                <button className="button button-quiet" disabled={status.isPending}
                  onClick={() => status.mutate({ path: `/${config.path}/${row.id}/status`,
                    body: { active: !row.active }, method: 'PATCH' })}>
                  {row.active ? 'Desactivar' : 'Activar'}
                </button> }] : []),
            ]} rows={query.data?.data ?? []}
              empty="No hay registros que coincidan con los filtros." />
            <Pagination page={page} limit={limit} total={query.data?.meta?.total ?? 0} onChange={setPage} />
          </Panel>
        </div>
        {canWrite && showForm ? (
          <div className="workspace-side">
            <Panel title="Nuevo registro">
              <form className="form-grid" onSubmit={submit}>
                {config.fields.map((field) => <Field key={field.key} label={field.label}>
                  {field.options ? (
                    <select required value={form[field.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}>
                      <option value="">Seleccionar…</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input required value={form[field.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />
                  )}
                </Field>)}
                {create.isError ? <ErrorState error={create.error} /> : null}
                <div className="form-actions">
                  <button className="button button-primary" disabled={create.isPending}>Guardar</button>
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
