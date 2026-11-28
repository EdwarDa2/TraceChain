'use client';

import { ClipboardCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  DataTable, ErrorState, Field, LoadingState, PageHeader, Pagination,
  Panel, StatusBadge,
} from '../../../components/ui';
import { useApiMutation, useApiQuery, useApiResponse } from '../../../hooks/use-api';
import type { Inspection, Lot, Product, Template } from '../../../lib/types';
import { useAuth } from '../../../providers/auth-provider';

export default function InspectionsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState('');
  const [productId, setProductId] = useState('');
  const [lotId, setLotId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [finding, setFinding] = useState('');
  const [inspectionResult, setInspectionResult] = useState('CONFORME');
  const limit = 20;
  const inspections = useApiResponse<Inspection[]>(
    `/inspections?page=${page}&limit=${limit}${result ? `&result=${result}` : ''}`);
  const lots = useApiResponse<Lot[]>('/lots?limit=100');
  const products = useApiResponse<Product[]>('/products?limit=100');
  const create = useApiMutation<Inspection>();
  const templateQuery = useApiQuery<Template>(productId ? `/inspection-templates/active?productId=${productId}` : null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const template = templateQuery.data;
    if (!template) return;
    const parameters = Object.fromEntries(template.parameters
      .filter((parameter) => values[parameter.key] !== undefined && values[parameter.key] !== '')
      .map((parameter) => {
        const raw = values[parameter.key];
        return [parameter.key, parameter.dataType === 'DECIMAL' ? raw
          : parameter.dataType === 'ENTERO' ? Number(raw)
            : parameter.dataType === 'BOOLEANO' ? raw === 'true' : raw];
      }));
    await create.mutateAsync({ path: '/inspections', idempotent: true, body: {
      lotId, templateId: template.id, templateVersion: template.version,
      inspectedAt: new Date().toISOString(), parameters, result: inspectionResult,
      findings: inspectionResult === 'NO_CONFORME' ? [{ type: 'OTRO', parameter: null,
        description: finding || 'Hallazgo registrado por el analista', severity: 'MEDIA' }] : [],
      evidence: [],
    } });
    setValues({}); setFinding('');
  }

  if (inspections.isPending || lots.isPending || products.isPending) return <LoadingState rows={4} />;
  if (inspections.isError) return <ErrorState error={inspections.error} />;

  return (
    <>
      <PageHeader title="Inspecciones" description="Espacio de trabajo de evidencia y hallazgos."
        actions={<span className="badge badge-neutral"><ClipboardCheck size={13} aria-hidden /> Plataforma de investigación</span>} />
      <div className="workspace">
        <div className="workspace-main">
          <Panel tight title={`Registro de inspecciones · ${inspections.data?.meta?.total ?? 0}`}
            actions={<select value={result} aria-label="Filtrar por resultado"
              onChange={(event) => { setResult(event.target.value); setPage(1); }} style={{ width: 150 }}>
              <option value="">Todos los resultados</option>
              <option value="CONFORME">Conformes</option>
              <option value="NO_CONFORME">No conformes</option>
            </select>}>
            <DataTable columns={[
              { key: 'code', label: 'Inspección' },
              { key: 'lotId', label: 'Lote' },
              { key: 'result', label: 'Resultado', render: (row) => <StatusBadge status={row.result} /> },
              { key: 'findingsCount', label: 'Hallazgos' },
              { key: 'inspectedAt', label: 'Fecha', render: (row) =>
                <span data-timestamp>{new Date(row.inspectedAt).toLocaleString('es-MX')}</span> },
            ]} rows={inspections.data?.data ?? []} empty="No hay inspecciones con este filtro." />
            <Pagination page={page} limit={limit} total={inspections.data?.meta?.total ?? 0} onChange={setPage} />
          </Panel>
        </div>
        {user?.role === 'ANALISTA_CALIDAD' ? (
          <div className="workspace-side">
            <Panel title="Nueva inspección">
              <form className="form-grid" onSubmit={submit}>
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
                {templateQuery.isPending ? <LoadingState rows={2} /> : null}
                {templateQuery.isError ? <ErrorState error={templateQuery.error} /> : null}
                {(templateQuery.data?.parameters ?? []).map((parameter) => (
                  <Field key={parameter.key} label={parameter.label}>
                    {parameter.dataType === 'SELECCION' || parameter.dataType === 'BOOLEANO' ? (
                      <select required={parameter.required} value={values[parameter.key] ?? ''}
                        onChange={(e) => setValues({ ...values, [parameter.key]: e.target.value })}>
                        <option value="">Seleccionar…</option>
                        {(parameter.dataType === 'BOOLEANO' ? ['true', 'false'] : parameter.options)
                          .map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input required={parameter.required} value={values[parameter.key] ?? ''}
                        onChange={(e) => setValues({ ...values, [parameter.key]: e.target.value })} />
                    )}
                  </Field>
                ))}
                <Field label="Resultado"><select value={inspectionResult}
                  onChange={(e) => setInspectionResult(e.target.value)}>
                  <option value="CONFORME">CONFORME</option>
                  <option value="NO_CONFORME">NO_CONFORME</option>
                </select></Field>
                {inspectionResult === 'NO_CONFORME' ? <Field label="Hallazgo">
                  <input required value={finding} onChange={(e) => setFinding(e.target.value)} />
                </Field> : null}
                {create.isError ? <ErrorState error={create.error} /> : null}
                <button className="button button-primary" disabled={create.isPending || !templateQuery.data}>
                  Registrar inspección
                </button>
              </form>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
