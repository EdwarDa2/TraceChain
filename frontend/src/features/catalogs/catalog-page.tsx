'use client';

import { useState, type FormEvent } from 'react';
import { DataTable, ErrorState, Field, LoadingState, PageHeader, SearchInput } from '../../components/ui';
import { useApiMutation, useApiQuery } from '../../hooks/use-api';
import type { Location, Product, Supplier } from '../../lib/types';
import { useAuth } from '../../providers/auth-provider';

type Item = Supplier | Product | Location;
type Config = {
  title: string;
  description: string;
  path: 'suppliers' | 'products' | 'locations';
  fields: { key: string; label: string; options?: string[] }[];
};

export function CatalogPage({ config }: { config: Config }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const query = useApiQuery<{ data: Item[] }>(
    `/${config.path}?search=${encodeURIComponent(search)}&limit=100`);
  const create = useApiMutation<Item>();
  const status = useApiMutation<Item>();
  const canWrite = user?.role === 'OPERADOR';

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync({ path: `/${config.path}`, body: form });
    setForm({});
  }

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} />;

  return (
    <>
      <PageHeader title={config.title} description={config.description} />
      {canWrite ? (
        <form className="card form-grid" style={{ marginBottom: 24 }} onSubmit={submit}>
          {config.fields.map((field) => (
            <Field key={field.key} label={field.label}>
              {field.options ? (
                <select value={form[field.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input required value={form[field.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} />
              )}
            </Field>
          ))}
          <div className="form-actions">
            <button className="button button-primary" disabled={create.isPending} type="submit">
              Crear
            </button>
            {create.isError ? <ErrorState error={create.error} /> : null}
          </div>
        </form>
      ) : null}
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder={`Buscar en ${config.title.toLowerCase()}`} />
      </div>
      <DataTable columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nombre' },
        { key: 'type', label: 'Tipo / unidad',
          render: (row) => {
            const item = row as Item & { type?: string; unit?: string };
            return <>{item.type}{item.unit ? ` · ${item.unit}` : ''}</>;
          } },
        { key: 'active', label: 'Estado',
          render: (row) => <span className={`badge ${row.active ? 'badge-success' : 'badge-danger'}`}>
            {row.active ? 'Activo' : 'Inactivo'}</span> },
        ...(canWrite ? [{ key: 'actions', label: 'Acciones',
          render: (row: Item) => (
            <button className="button" disabled={status.isPending}
              onClick={() => status.mutate({ path: `/${config.path}/${row.id}/status`,
                body: { active: !row.active }, method: 'PATCH' })}>
              {row.active ? 'Desactivar' : 'Activar'}
            </button>
          ) }] : []),
      ]} rows={query.data?.data ?? []} empty={`No hay ${config.title.toLowerCase()} registrados.`} />
    </>
  );
}
