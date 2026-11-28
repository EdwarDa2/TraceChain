'use client';

import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: {
  title: string; description?: string; actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, actions, children, tight = false }: {
  title?: string; actions?: ReactNode; children: ReactNode; tight?: boolean;
}) {
  return (
    <section className="panel">
      {title ? (
        <header className="panel-header">
          <h2>{title}</h2>
          {actions ? <div className="toolbar">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`panel-body${tight ? ' tight' : ''}`}>{children}</div>
    </section>
  );
}

function tone(status: string): string {
  if (['CERRADA', 'CONFORME', 'SINCRONIZADO', 'COMPLETO', 'AVAILABLE', 'ACTIVO'].includes(status)) return 'success';
  if (['ABIERTA', 'EN_ANALISIS', 'PENDIENTE', 'PARCIAL', 'PROCESANDO'].includes(status)) return 'warning';
  if (['ERROR', 'FALLIDO', 'NO_DISPONIBLE', 'UNAVAILABLE', 'NO_CONFORME'].includes(status)) return 'danger';
  return 'neutral';
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${tone(status)}`}>{status.replaceAll('_', ' ')}</span>;
}

export function SyncStatus({ status }: { status: string }) {
  return <span className={`sync-dot badge-${tone(status)}`}><i />{status}</span>;
}

export function QuantityDisplay({ value, unit }: { value: string; unit?: string }) {
  return <span data-numeric>{value}{unit ? ` ${unit}` : ''}</span>;
}

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div style={{ display: 'grid', gap: 8, maxWidth: 360, margin: '0 auto' }}>
        {Array.from({ length: rows }, (_, index) => <div className="skeleton" key={index} />)}
      </div>
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'No se pudo completar la solicitud.';
  return <div className="state state-error" role="alert">{message}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="state">{children}</div>;
}

export type Column<T> = { key: string; label: string; render?: (row: T) => ReactNode; title?: boolean };

export function DataTable<T extends object>({ columns, rows, empty = 'Sin resultados.',
  rowKey, onRowClick }: {
  columns: Column<T>[]; rows: T[]; empty?: ReactNode;
  rowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
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
            <tr key={rowKey?.(row, index) ?? String((row as Record<string, unknown>).id ?? index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}>
              {columns.map((column) => {
                const value = (row as Record<string, unknown>)[column.key];
                return <td key={column.key} title={column.title ? String(value ?? '') : undefined}>
                  {column.render ? column.render(row) : value === null || value === undefined || value === ''
                    ? <span data-muted>—</span> : String(value)}
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, limit, total, onChange }: {
  page: number; limit: number; total: number; onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="table-footer">
      <span>{total} registros · página {page} de {pages}</span>
      <div className="toolbar">
        <button className="button button-quiet" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
        <button className="button button-quiet" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente</button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…' }: {
  value: string; onChange: (value: string) => void; placeholder?: string;
}) {
  return <input className="search" type="search" value={value} placeholder={placeholder}
    aria-label={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint ? <span>{hint}</span> : null}</label>;
}
