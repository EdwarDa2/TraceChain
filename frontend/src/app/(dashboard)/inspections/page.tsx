'use client';

import { useState, type FormEvent } from 'react';
import { DataTable, ErrorState, Field, LoadingState, PageHeader, StatusBadge } from '../../../components/ui';
import { useApiMutation, useApiQuery } from '../../../hooks/use-api';
import type { Inspection, Lot, Product, Template } from '../../../lib/types';
import { useAuth } from '../../../providers/auth-provider';

export default function InspectionsPage() {
  const { user } = useAuth();
  const inspections = useApiQuery<{ data: Inspection[] }>('/inspections?limit=100');
  const lots = useApiQuery<{ data: Lot[] }>('/lots?limit=100');
  const products = useApiQuery<{ data: Product[] }>('/products?limit=100');
  const create = useApiMutation<Inspection>();
  const [productId, setProductId] = useState('');
  const [lotId, setLotId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState('CONFORME');
  const [finding, setFinding] = useState('');
  const templateQuery = useApiQuery<Template>(productId ? `/inspection-templates/active?productId=${productId}` : null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const template = templateQuery.data;
    if (!template) return;
    const parameters = Object.fromEntries(template.parameters
      .filter((parameter) => values[parameter.key] !== undefined && values[parameter.key] !== '')
      .map((parameter) => {
        const raw = values[parameter.key];
        const value = parameter.dataType === 'DECIMAL' ? raw
          : parameter.dataType === 'ENTERO' ? Number(raw)
            : parameter.dataType === 'BOOLEANO' ? raw === 'true' : raw;
        return [parameter.key, value];
      }));
    await create.mutateAsync({ path: '/inspections', idempotent: true, body: {
      lotId, templateId: template.id, templateVersion: template.version,
      inspectedAt: new Date().toISOString(), parameters, result,
      findings: result === 'NO_CONFORME' ? [{ type: 'OTRO', parameter: null,
        description: finding || 'Hallazgo registrado por el analista', severity: 'MEDIA' }] : [],
      evidence: [],
    } });
    setValues({});
    setFinding('');
  }

  if (inspections.isPending || lots.isPending || products.isPending) return <LoadingState />;
  if (inspections.isError) return <ErrorState error={inspections.error} />;
  return (
    <>
      <PageHeader title="Inspecciones" description="Resultados variables por plantilla activa." />
      {user?.role === 'ANALISTA_CALIDAD' ? (
        <form className="card form-grid" style={{ marginBottom: 24 }} onSubmit={submit}>
          <Field label="Producto"><select required value={productId}
            onChange={(e) => { setProductId(e.target.value); setValues({}); }}>
            <option value="">Seleccionar…</option>
            {(products.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></Field>
          <Field label="Lote"><select required value={lotId}
            onChange={(e) => setLotId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {(lots.data?.data ?? []).filter((item) => item.productId === productId)
              .map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
          </select></Field>
          {templateQuery.isPending ? <LoadingState /> : null}
          {templateQuery.isError ? <ErrorState error={templateQuery.error} /> : null}
          {(templateQuery.data?.parameters ?? []).map((parameter) => (
            <Field key={parameter.key} label={`${parameter.label}${parameter.required ? ' *' : ''}`}>
              {parameter.dataType === 'SELECCION' ? (
                <select required={parameter.required} value={values[parameter.key] ?? ''}
                  onChange={(e) => setValues({ ...values, [parameter.key]: e.target.value })}>
                  <option value="">Seleccionar…</option>
                  {parameter.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : parameter.dataType === 'BOOLEANO' ? (
                <select required={parameter.required} value={values[parameter.key] ?? ''}
                  onChange={(e) => setValues({ ...values, [parameter.key]: e.target.value })}>
                  <option value="">Seleccionar…</option><option value="true">Sí</option><option value="false">No</option>
                </select>
              ) : (
                <input required={parameter.required} value={values[parameter.key] ?? ''}
                  onChange={(e) => setValues({ ...values, [parameter.key]: e.target.value })} />
              )}
            </Field>
          ))}
          <Field label="Resultado"><select value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="CONFORME">CONFORME</option>
            <option value="NO_CONFORME">NO_CONFORME</option>
          </select></Field>
          {result === 'NO_CONFORME' ? <Field label="Hallazgo">
            <input required value={finding} onChange={(e) => setFinding(e.target.value)} />
          </Field> : null}
          <div className="form-actions">
            <button className="button button-primary" disabled={create.isPending ||
              !templateQuery.data} type="submit">Registrar inspección</button>
            {create.isError ? <ErrorState error={create.error} /> : null}
          </div>
        </form>
      ) : null}
      <DataTable columns={[
        { key: 'code', label: 'Código' },
        { key: 'lotId', label: 'Lote' },
        { key: 'result', label: 'Resultado', render: (row) => <StatusBadge status={row.result} /> },
        { key: 'inspectedAt', label: 'Fecha',
          render: (row) => <span data-timestamp>{new Date(row.inspectedAt).toLocaleString('es-MX')}</span> },
      ]} rows={inspections.data?.data ?? []} empty="Sin inspecciones registradas." />
    </>
  );
}
