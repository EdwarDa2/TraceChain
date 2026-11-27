import { Body, Controller, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AnalystGuard } from '../auth/auth.controller';
import { BlockWriteService } from './block-write.service';

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function id(value: string) {
  if (!VALID_UUID.test(value)) throw new Error('VALIDATION_ERROR');
  return value;
}
function key(value: string | undefined) {
  if (!value || !VALID_UUID.test(value)) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  return value;
}
function record(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((field) => !fields.includes(field))) {
    throw new Error('VALIDATION_ERROR');
  }
  return value as Record<string, unknown>;
}

@Controller('api/v1/incidents')
@UseGuards(AnalystGuard)
export class IncidentBlocksController {
  constructor(private readonly blocks: BlockWriteService) {}

  @Post(':id/blocks')
  async block(@Param('id') incidentId: string, @Body() value: unknown,
    @Headers('idempotency-key') rawKey: string | undefined, @Req() request: { actor: { id: string } }) {
    const body = record(value, ['lotIds', 'reason']);
    if (!Array.isArray(body.lotIds) || body.lotIds.some((lot) =>
      typeof lot !== 'string' || !VALID_UUID.test(lot)) ||
      typeof body.reason !== 'string') throw new Error('VALIDATION_ERROR');
    return { data: await this.blocks.block(id(incidentId), body.lotIds, body.reason,
      request.actor.id, key(rawKey)) };
  }
}

@Controller('api/v1/lot-blocks')
@UseGuards(AnalystGuard)
export class LotBlocksController {
  constructor(private readonly blocks: BlockWriteService) {}

  @Post(':id/release')
  @HttpCode(200)
  async release(@Param('id') blockId: string, @Body() value: unknown,
    @Headers('idempotency-key') rawKey: string | undefined, @Req() request: { actor: { id: string } }) {
    const body = record(value, ['reason']);
    if (typeof body.reason !== 'string') throw new Error('VALIDATION_ERROR');
    return { data: await this.blocks.release(id(blockId), body.reason, request.actor.id, key(rawKey)) };
  }
}
