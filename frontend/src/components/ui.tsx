'use client';

import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: {
  title: string; description?: string; actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p data-muted>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = ['CERRADA', 'CONFORME', 'SINCRONIZADO', 'COMPLETO', 'AVAILABLE'].includes(status)
    ? 'success'
    : ['ABIERTA', 'EN_ANALISIS', 'PENDIENTE', 'PARCIAL', 'PROCESANDO'].includes(status)
      ? 'warning'
      : ['ERROR', 'FALLIDO', 'NO_DISPONIBLE', 'UNAVAILABLE'].includes(status) ? 'danger' : 'neutral';
  return <span className={`badge badge-${tone}`}>{status.replaceAll('_', ' ')}</span>;
}

export function SyncStatus({ status }: { status: string }) {
  return <span className="sync"><i data-sync={status} />{status}</span>;
}

export function QuantityDisplay({ value, unit }: { value: string; unit?: string }) {
  return <span data-numeric>{value}{unit ? ` ${unit}` : ''}</span>;
}

export function LoadingState() {
  return <div className="state" role="status">Cargando datos reales…</div>;
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Error inesperado';
  return <div className="state state-error" role="alert">{message}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="state">{children}</div>;
}

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
};

export function DataTable<T extends object>({ columns, rows, empty = 'Sin resultados.' }: {
  columns: Column<T>[]; rows: T[]; empty?: string;
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String((row as Record<string, unknown>).id ?? index)}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…' }: {
  value: string; onChange: (value: string) => void; placeholder?: string;
}) {
  return (
    <input className="search" type="search" value={value}
      placeholder={placeholder} aria-label={placeholder}
      onChange={(event) => onChange(event.target.value)} />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
