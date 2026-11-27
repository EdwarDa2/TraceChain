import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Decimal128, Int32, type Document } from 'mongodb';
import type { InspectionCreate } from '@tracechain/contracts';
import { SqlService } from '../../database/postgres/sql.service';
import { MongoService } from '../../database/mongodb/mongo.service';
import { validateInspectionParameters, type TemplateParameter } from './parameters.validator.mts';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]));
  return value;
}
function hashOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

@Injectable()
export class InspectionsService {
  constructor(private readonly sql: SqlService, private readonly mongo: MongoService) {}

  async create(input: InspectionCreate, inspectorId: string, key: string) {
    const collection = this.mongo.db.collection<Document & { _id: string }>('inspecciones_calidad');
    const hash = hashOf(input);
    const existing = await collection.findOne({ inspector_id: inspectorId, idempotency_key: key });
    if (existing) {
      if (existing.request_hash !== hash) throw new Error('IDEMPOTENCY_CONFLICT');
      return created(existing);
    }
    const lot = (await this.sql.pool.query<{ producto_id: string; fecha_origen: Date }>(
      'SELECT producto_id, fecha_origen FROM lotes WHERE id=$1', [input.lotId])).rows[0];
    if (!lot) throw new Error('RESOURCE_NOT_FOUND');
    const inspected = new Date(input.inspectedAt);
    if (!Number.isFinite(inspected.getTime()) ||
        inspected.getTime() < new Date(lot.fecha_origen).getTime() ||
        inspected.getTime() > Date.now()) throw new Error('INVALID_OPERATION_DATE');
    const templates = this.mongo.db.collection<Document & { _id: string }>('plantillas_inspeccion');
    const specific = await templates.findOne({ producto_id: lot.producto_id, activo: true });
    const selected = specific ?? await templates.findOne({ producto_id: null, activo: true });
    if (!selected) throw new Error('TEMPLATE_UNAVAILABLE');
    if (selected._id !== input.templateId || selected.version !== input.templateVersion) {
      throw new Error('INVALID_TEMPLATE');
    }
    const parameters: TemplateParameter[] = (selected.parametros as Document[]).map((item) => ({
      key: String(item.key), label: String(item.label), dataType: item.dataType,
      unit: item.unit === null ? null : String(item.unit),
      required: item.required === true, options: item.options as string[],
      min: item.min === null ? null : item.min.toString(),
      max: item.max === null ? null : item.max.toString(),
    }));
    const result = validateInspectionParameters(parameters, input.parameters);
    if (!result.ok) throw new Error('INVALID_INSPECTION_PARAMETERS');
    if (!['CONFORME', 'NO_CONFORME'].includes(input.result) ||
        !Array.isArray(input.findings) || input.findings.length > 30 ||
        input.result === 'NO_CONFORME' && input.findings.length === 0 ||
        !Array.isArray(input.evidence) || input.evidence.length > 20) {
      throw new Error('INVALID_INSPECTION_PARAMETERS');
    }
    for (const finding of input.findings) {
      if (!['IMPUREZAS', 'HUMEDAD', 'PESO', 'EMPAQUE', 'APARIENCIA', 'TEXTURA', 'TEMPERATURA', 'OTRO'].includes(finding.type) ||
          !['BAJA', 'MEDIA', 'ALTA'].includes(finding.severity) ||
          typeof finding.description !== 'string' || finding.description.length === 0 ||
          finding.description.length > 5000 ||
          finding.parameter !== null && !parameters.some((item) => item.key === finding.parameter)) {
        throw new Error('INVALID_INSPECTION_PARAMETERS');
      }
    }
    for (const evidence of input.evidence) {
      if (!['IMAGEN', 'DOCUMENTO', 'REFERENCIA'].includes(evidence.type) ||
          typeof evidence.reference !== 'string' || evidence.reference.length === 0 ||
          evidence.reference.length > 500 ||
          evidence.description !== undefined && evidence.description !== null &&
            (typeof evidence.description !== 'string' || evidence.description.length > 5000)) {
        throw new Error('INVALID_INSPECTION_PARAMETERS');
      }
    }
    const id = randomUUID();
    const createdAt = new Date();
    const typedParameters: Record<string, unknown> = {};
    for (const parameter of parameters) {
      if (!(parameter.key in result.values)) continue;
      const value = result.values[parameter.key];
      typedParameters[parameter.key] = parameter.dataType === 'DECIMAL'
        ? Decimal128.fromString(value as string)
        : parameter.dataType === 'ENTERO' ? new Int32(value as number) : value;
    }
    const document = {
      _id: id, codigo: `INS-${id}`, lote_id: input.lotId, producto_id: lot.producto_id,
      plantilla_id: input.templateId, plantilla_version: new Int32(input.templateVersion),
      inspector_id: inspectorId, fecha_inspeccion: inspected, parametros: typedParameters,
      resultado: input.result, hallazgos: input.findings.map((finding) => ({
        tipo: finding.type, parametro: finding.parameter, descripcion: finding.description,
        severidad: finding.severity,
      })), observaciones: input.notes ?? null,
      evidencias: input.evidence.map((evidence) => ({
        tipo: evidence.type, referencia: evidence.reference, descripcion: evidence.description ?? null,
        fecha_registro: createdAt,
      })), idempotency_key: key, request_hash: hash, created_at: createdAt,
    };
    try {
      await collection.insertOne(document);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
      const winner = await collection.findOne({ inspector_id: inspectorId, idempotency_key: key });
      if (!winner || winner.request_hash !== hash) throw new Error('IDEMPOTENCY_CONFLICT');
      return created(winner);
    }
    return created(document);
  }
}

function created(doc: Document) {
  return {
    id: String(doc._id), code: String(doc.codigo), lotId: String(doc.lote_id),
    result: doc.result as 'CONFORME' | 'NO_CONFORME',
    createdAt: new Date(doc.created_at as Date).toISOString(),
    findingsCount: (doc.hallazgos as unknown[]).length,
  };
}
