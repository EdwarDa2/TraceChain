import { Body, Controller, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { EvidenceCreate, Finding, IncidentCreate } from '@tracechain/contracts';
import { AnalystGuard } from '../auth/auth.controller';
import { IncidentWriteService } from './incident-write.service';

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
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('VALIDATION_ERROR');
  return value;
}

@Controller('api/v1/incidents')
@UseGuards(AnalystGuard)
export class IncidentsController {
  constructor(private readonly service: IncidentWriteService) {}

  @Post()
  async create(@Body() value: unknown, @Headers('idempotency-key') key: string | undefined,
    @Req() request: { actor: { id: string } }) {
    if (!key || !UUID.test(key)) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const body = object(value, ['originLotId', 'title', 'type', 'severity',
      'detectedAt', 'description', 'inspectionIds', 'findings', 'evidence', 'notes']);
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
      throw new Error('VALIDATION_ERROR');
    }
    const findings: Finding[] = array(body.findings).map((value) => {
      const item = object(value, ['type', 'parameter', 'description', 'severity']);
      if (item.parameter !== null) throw new Error('VALIDATION_ERROR');
      return { type: text(item.type) as Finding['type'], parameter: null,
        description: text(item.description), severity: text(item.severity) as Finding['severity'] };
    });
    const evidence: EvidenceCreate[] = array(body.evidence).map((value) => {
      const item = object(value, ['type', 'reference', 'description']);
      return { type: text(item.type) as EvidenceCreate['type'], reference: text(item.reference),
        description: item.description == null ? null : text(item.description) };
    });
    const input: IncidentCreate = {
      originLotId: uuid(body.originLotId), title: text(body.title),
      type: text(body.type) as IncidentCreate['type'],
      severity: text(body.severity) as IncidentCreate['severity'],
      detectedAt: text(body.detectedAt), description: text(body.description),
      inspectionIds: array(body.inspectionIds).map(uuid), findings, evidence,
      notes: body.notes as string | null | undefined,
    };
    return { data: await this.service.create(input, request.actor.id, key) };
  }

  @Post(':id/start-analysis')
  @HttpCode(200)
  async startAnalysis(@Param('id') rawId: string, @Body() value: unknown,
    @Headers('idempotency-key') key: string | undefined, @Req() request: { actor: { id: string } }) {
    if (!key || !UUID.test(key)) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    object(value ?? {}, []);
    return { data: await this.service.startAnalysis(uuid(rawId), request.actor.id, key) };
  }

  @Post(':id/close')
  @HttpCode(200)
  async close(@Param('id') rawId: string, @Body() value: unknown,
    @Headers('idempotency-key') key: string | undefined, @Req() request: { actor: { id: string } }) {
    if (!key || !UUID.test(key)) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const body = object(value, ['resolution']);
    return { data: await this.service.close(uuid(rawId), text(body.resolution), request.actor.id, key) };
  }
}
