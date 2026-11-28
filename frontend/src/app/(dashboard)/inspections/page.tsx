'use client';

import { useRouter } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { LotLabel } from '../../../components/lot-label';
import {
  DataTable, ErrorState, Field, LoadingState, PageHeader, Pagination,
  Panel, StatusBadge,
} from '../../../components/ui';
import { useApiMutation, useApiQuery, useApiResponse } from '../../../hooks/use-api';
import { statusLabel } from '../../../lib/labels';
import type { Inspection, Lot, Product, Template } from '../../../lib/types';
import { useAuth } from '../../../providers/auth-provider';

type QualitySummary = { totalInspections: string | number; conforming: string | number;
  nonConforming: string | number; nonConformingPercentage: number | null;
  byProduct: { productName: string; nonConforming: string | number }[] };
type FindingCount = { key: string; count: string | number };

export default function InspectionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState('');
  const [productId, setProductId] = useState('');
  const [lotId, setLotId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [finding, setFinding] = useState('');
  const [inspectionResult, setInspectionResult] = useState('CONFORME');
  const limit = 20;
  const inspections = useApiResponse<Inspection[]>(
    `/inspections?page=${page}&limit=${limit}${result ? `&result=${result}` : ''}`);
  const lots = useApiResponse<Lot[]>('/lots?limit=100');
  const products = useApiResponse<Product[]>('/products?limit=100');
  const quality = useApiQuery<QualitySummary>('/quality/summary');
  const findings = useApiQuery<FindingCount[]>('/quality/findings?groupBy=type');
  const detail = useApiQuery<Inspection>(detailId ? `/inspections/${detailId}` : null);
  const create = useApiMutation<Inspection>();
  const templateQuery = useApiQuery<Template>(productId ? `/inspection-templates/active?productId=${productId}` : null);

  function toggle(lotIdentifier: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(lotIdentifier)) next.delete(lotIdentifier);
      else if (next.size < 5) next.add(lotIdentifier);
      return next;
    });
  }

  function analyze() {
    const identifiers = [...selected].slice(0, 5);
    if (identifiers.length < 2) return;
    router.push(`/traceability?mode=COMMON_ORIGINS&lotIds=${encodeURIComponent(identifiers.join(','))}`);
  }

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

  const rows = inspections.data?.data ?? [];
  const selectionReady = selected.size >= 2 && selected.size <= 5;

  return (
    <>
      <PageHeader title="Inspecciones" description="Evidencia, hallazgos y punto de entrada del análisis."
        actions={<button className="button button-primary" disabled={!selectionReady} onClick={analyze}>
          <ClipboardCheck size={14} aria-hidden /> Analizar antecedentes comunes
        </button>} />
      <div className="workspace">
        <div className="workspace-main">
          <Panel title="Perfil de calidad" tight>
            <div className="quality-strip">
              <div><strong>{String(quality.data?.totalInspections ?? '—')}</strong><span>Inspecciones</span></div>
              <div><strong>{String(quality.data?.nonConforming ?? '—')}</strong><span>No conformes</span></div>
              <div><strong>{quality.data?.nonConformingPercentage === null
                ? 'sin datos' : `${quality.data?.nonConformingPercentage ?? '—'}%`}</strong><span>Proporción</span></div>
            </div>
            {(findings.data ?? []).length > 0 ? (
              <p data-muted className="critical-note">Hallazgos por tipo: {(findings.data ?? [])
                .map((item) => `${statusLabel(item.key)} ${item.count}`).join(' · ')}</p>
            ) : null}
          </Panel>

          <Panel tight title={`Registro de inspecciones · ${inspections.data?.meta?.total ?? 0}`}
            actions={<select value={result} aria-label="Filtrar por resultado"
              onChange={(event) => { setResult(event.target.value); setPage(1); setSelected(new Set()); }} style={{ width: 150 }}>
              <option value="">Todos los resultados</option>
              <option value="CONFORME">Conformes</option>
              <option value="NO_CONFORME">No conformes</option>
            </select>}>
            <div className="selection-actions">
              <span data-muted>Selecciona de 2 a 5 lotes no conformes para analizar antecedentes comunes.</span>
              <span data-numeric>{selected.size}/5</span>
              <button className="button" disabled={!selectionReady} onClick={analyze}>Analizar selección</button>
            </div>
            <DataTable columns={[
              { key: 'select', label: '', srLabel: 'Seleccionar', render: (row) =>
                <input type="checkbox" aria-label={`Seleccionar lote ${row.lotId}`}
                  checked={selected.has(row.lotId)} disabled={row.result === 'CONFORME'}
                  onChange={() => toggle(row.lotId)} /> },
              { key: 'code', label: 'Inspección' },
              { key: 'lotId', label: 'Lote', render: (row) => <LotLabel lotId={row.lotId} /> },
              { key: 'result', label: 'Resultado', render: (row) => <StatusBadge status={row.result} /> },
              { key: 'findingsCount', label: 'Hallazgos' },
              { key: 'inspectedAt', label: 'Fecha', render: (row) =>
                <span data-timestamp>{new Date(row.inspectedAt).toLocaleString('es-MX')}</span> },
              { key: 'detail', label: '', srLabel: 'Detalle', render: (row) =>
                <button className="button button-quiet" onClick={() => setDetailId(row.id)}>Detalle</button> },
            ]} rows={rows} empty="No hay inspecciones con este filtro." />
            <p data-muted className="critical-note">Un origen común es una hipótesis, no una causa. Las no conformidades cuentan inspecciones, no lotes contaminados.</p>
            <Pagination page={page} limit={limit} total={inspections.data?.meta?.total ?? 0} onChange={setPage} />
          </Panel>
        </div>
        {user?.role === 'ANALISTA_CALIDAD' ? (
          <div className="workspace-side">
            {detailId ? (
              <Panel title="Detalle de inspección" actions={
                <button className="button button-quiet" onClick={() => setDetailId(null)}>Cerrar</button>}>
                {detail.isPending ? <LoadingState rows={2} /> : null}
                {detail.data ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <p><strong>{detail.data.code}</strong> · <StatusBadge status={detail.data.result} /></p>
                    <p data-muted>Versión de plantilla {detail.data.templateVersion}</p>
                    <div>{Object.entries(detail.data.parameters).map(([key, value]) =>
                      <p key={key}><strong>{key}:</strong> {String(value)}</p>)}</div>
                    <div>{(detail.data.findings ?? []).map((item, index) =>
                      <p key={index}><strong>{statusLabel(item.type)}</strong> · {statusLabel(item.severity)} · {item.description}</p>)}</div>
                    <div>{(detail.data.evidence ?? []).map((item, index) =>
                      <p key={index} data-muted>Evidencia {statusLabel(item.type)}: {item.reference}</p>)}</div>
                  </div>
                ) : null}
              </Panel>
            ) : null}
            <Panel title="Nueva inspección">
              <form className="form-grid" onSubmit={submit}>
                <Field label="Producto"><select required value={productId}
                  onChange={(e) => { setProductId(e.target.value); setValues({}); }}>
                  <option value="">Seleccionar…</option>
                  {(products.data?.data ?? []).map((item) =>
                    <option key={item.id} value={item.id}>{`${item.code} · ${item.name} · ${statusLabel(item.type)} · ${item.unit}`}</option>)}
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
                  <option value="CONFORME">Conforme</option>
                  <option value="NO_CONFORME">No conforme</option>
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
