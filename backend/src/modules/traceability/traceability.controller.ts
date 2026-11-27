import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AnalystGuard, AuthGuard } from '../auth/auth.controller';
import { TraceabilityService } from './traceability.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function validId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error('VALIDATION_ERROR');
  return value;
}
function depthOf(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^(?:[1-9]|1[0-9]|20)$/.test(value)) {
    throw new Error('VALIDATION_ERROR');
  }
  return Number(value);
}
function body(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error('VALIDATION_ERROR');
  }
  return value as Record<string, unknown>;
}
function depth(value: unknown): number {
  if (value === undefined) return 10;
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('VALIDATION_ERROR');
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) throw new Error('VALIDATION_ERROR');
  return parsed;
}

@Controller('api/v1/traceability')
@UseGuards(AuthGuard)
export class TraceabilityController {
  constructor(private readonly trace: TraceabilityService) {}

  @Get(':lotId/forward')
  async forward(@Param('lotId') lotId: string, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).some((key) => key !== 'maxDepth')) throw new Error('VALIDATION_ERROR');
    return { data: await this.trace.forward(validId(lotId), depthOf(query.maxDepth, 10)) };
  }

  @Get(':lotId/backward')
  async backward(@Param('lotId') lotId: string, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).some((key) => key !== 'maxDepth')) throw new Error('VALIDATION_ERROR');
    return { data: await this.trace.backward(validId(lotId), depthOf(query.maxDepth, 10)) };
  }

  @Get(':lotId/genealogy')
  async genealogy(@Param('lotId') lotId: string, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).some((key) => key !== 'maxDepth')) throw new Error('VALIDATION_ERROR');
    return { data: await this.trace.genealogy(validId(lotId), depthOf(query.maxDepth, 10)) };
  }

  @Post('common-origins')
  @HttpCode(200)
  @UseGuards(AnalystGuard)
  async common(@Body() value: unknown) {
    const input = body(value, ['lotIds', 'maxDepth']);
    if (!Array.isArray(input.lotIds) || input.lotIds.length < 2 || input.lotIds.length > 5 ||
        input.lotIds.some((id) => typeof id !== 'string' || !UUID.test(id)) ||
        new Set(input.lotIds).size !== input.lotIds.length) throw new Error('VALIDATION_ERROR');
    return { data: await this.trace.common(input.lotIds, depth(input.maxDepth)) };
  }

  @Post('paths')
  @HttpCode(200)
  async paths(@Body() value: unknown) {
    const input = body(value, ['sourceLotId', 'targetLotId', 'mode', 'maxDepth', 'maxPaths']);
    const mode = input.mode;
    if (mode !== 'SHORTEST' && mode !== 'ALL') throw new Error('VALIDATION_ERROR');
    let maxPaths = 50;
    if (input.maxPaths !== undefined) {
      if (typeof input.maxPaths !== 'string' && typeof input.maxPaths !== 'number') {
        throw new Error('VALIDATION_ERROR');
      }
      maxPaths = Number(input.maxPaths);
      if (!Number.isInteger(maxPaths) || maxPaths < 1 || maxPaths > 50) {
        throw new Error('VALIDATION_ERROR');
      }
    }
    return { data: await this.trace.paths(validId(input.sourceLotId), validId(input.targetLotId),
      mode, depth(input.maxDepth), maxPaths) };
  }
}
