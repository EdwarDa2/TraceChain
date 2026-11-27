import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { EvidenceCreate, Finding, InspectionCreate } from '@tracechain/contracts';
import { AnalystGuard } from '../auth/auth.controller';
import { InspectionsService } from './inspections.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))) throw new Error('VALIDATION_ERROR');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('VALIDATION_ERROR');
  return value;
}
function uuid(value: unknown): string {
  const result = text(value);
  if (!UUID.test(result)) throw new Error('VALIDATION_ERROR');
  return result;
}
function records(value: unknown, allowed: string[]) {
  if (!Array.isArray(value)) throw new Error('VALIDATION_ERROR');
  return value.map((item) => object(item, allowed));
}

@Controller('api/v1/inspections')
@UseGuards(AnalystGuard)
export class InspectionsController {
  constructor(private readonly service: InspectionsService) {}

  @Post()
  async create(@Body() value: unknown, @Headers('idempotency-key') key: string | undefined,
    @Req() request: { actor: { id: string } }) {
    if (!key || !UUID.test(key)) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const body = object(value, ['lotId', 'templateId', 'templateVersion', 'inspectedAt',
      'parameters', 'result', 'findings', 'notes', 'evidence']);
    const params = object(body.parameters, Object.keys(body.parameters ?? {}));
    if (Object.values(params).some((item) =>
      !['string', 'number', 'boolean'].includes(typeof item))) throw new Error('VALIDATION_ERROR');
    if (!Number.isInteger(body.templateVersion) || (body.templateVersion as number) < 1 ||
        typeof body.result !== 'string' ||
        body.notes !== undefined && body.notes !== null &&
          (typeof body.notes !== 'string' || body.notes.length > 3000)) throw new Error('VALIDATION_ERROR');
    const findings: Finding[] = records(body.findings, ['type', 'parameter', 'description', 'severity'])
      .map((item) => ({
        type: text(item.type) as Finding['type'],
        parameter: item.parameter === null ? null : text(item.parameter),
        description: text(item.description), severity: text(item.severity) as Finding['severity'],
      }));
    const evidence: EvidenceCreate[] = records(body.evidence, ['type', 'reference', 'description'])
      .map((item) => ({
        type: text(item.type) as EvidenceCreate['type'],
        reference: text(item.reference),
        description: item.description == null ? null : text(item.description),
      }));
    const input: InspectionCreate = {
      lotId: uuid(body.lotId), templateId: uuid(body.templateId),
      templateVersion: body.templateVersion as number, inspectedAt: text(body.inspectedAt),
      parameters: params as InspectionCreate['parameters'],
      result: body.result as InspectionCreate['result'], findings,
      notes: body.notes as string | null | undefined, evidence,
    };
    return { data: await this.service.create(input, request.actor.id, key) };
  }
}
