import { Body, Controller, Headers, Injectable, Post, Req, UseGuards } from '@nestjs/common';
import { SqlService } from '../../database/postgres/sql.service';
import { createSqlOperationsDeps } from '../../database/postgres/operations-repository.mts';
import { OperatorGuard } from '../auth/auth.controller';
import {
  registrarRecepcion, registrarProduccion, registrarDistribucion,
  type RecepcionEntrada, type ProduccionEntrada, type DistribucionEntrada,
} from './operations.mts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function record(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))) throw new Error('VALIDATION_ERROR');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('VALIDATION_ERROR');
  return value;
}
function id(value: unknown): string {
  const result = string(value);
  if (!UUID.test(result)) throw new Error('VALIDATION_ERROR');
  return result;
}
function optionalDate(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value) ||
      !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) throw new Error('VALIDATION_ERROR');
  return value;
}
function items(value: unknown, allowed: string[]) {
  if (!Array.isArray(value)) throw new Error('VALIDATION_ERROR');
  return value.map((item) => record(item, allowed));
}
function key(value: string | undefined): string {
  if (!value || !UUID.test(value)) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  return value;
}
type OperatorRequest = { actor: { id: string } };

@Injectable()
export class OperationsService {
  constructor(private readonly sql: SqlService) {}
  receipt(value: RecepcionEntrada) {
    return registrarRecepcion(value, createSqlOperationsDeps(this.sql.pool));
  }
  production(value: ProduccionEntrada) {
    return registrarProduccion(value, createSqlOperationsDeps(this.sql.pool));
  }
  distribution(value: DistribucionEntrada) {
    return registrarDistribucion(value, createSqlOperationsDeps(this.sql.pool));
  }
}

@Controller('api/v1')
@UseGuards(OperatorGuard)
export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  @Post('lots/receipts')
  async receipt(@Body() value: unknown, @Headers('idempotency-key') rawKey: string | undefined,
    @Req() request: OperatorRequest) {
    const body = record(value, ['code', 'productId', 'supplierId', 'supplierLotCode',
      'locationId', 'quantity', 'receivedAt', 'expirationDate']);
    if (body.supplierLotCode !== undefined && body.supplierLotCode !== null &&
        (typeof body.supplierLotCode !== 'string' || body.supplierLotCode.length > 100)) {
      throw new Error('VALIDATION_ERROR');
    }
    const result = await this.service.receipt({
      code: string(body.code), productId: id(body.productId), supplierId: id(body.supplierId),
      locationId: id(body.locationId), quantity: string(body.quantity),
      receivedAt: string(body.receivedAt), expirationDate: optionalDate(body.expirationDate),
      supplierLotCode: body.supplierLotCode as string | null | undefined,
      actorId: request.actor.id, idempotencyKey: key(rawKey),
    });
    return { data: result };
  }

  @Post('production-orders')
  async production(@Body() value: unknown, @Headers('idempotency-key') rawKey: string | undefined,
    @Req() request: OperatorRequest) {
    const body = record(value, ['name', 'locationId', 'producedAt', 'notes', 'inputs', 'outputs']);
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
      throw new Error('VALIDATION_ERROR');
    }
    const inputs = items(body.inputs, ['lotId', 'quantity']).map((item) => ({
      lotId: id(item.lotId), quantity: string(item.quantity),
    }));
    const outputs = items(body.outputs, ['code', 'productId', 'quantity', 'expirationDate'])
      .map((item) => ({ code: string(item.code), productId: id(item.productId),
        quantity: string(item.quantity), expirationDate: optionalDate(item.expirationDate) }));
    return { data: await this.service.production({
      name: string(body.name), locationId: id(body.locationId),
      producedAt: string(body.producedAt), inputs, outputs,
      notes: body.notes as string | null | undefined,
      actorId: request.actor.id, idempotencyKey: key(rawKey),
    }) };
  }

  @Post('distributions')
  async distribution(@Body() value: unknown, @Headers('idempotency-key') rawKey: string | undefined,
    @Req() request: OperatorRequest) {
    const body = record(value, ['originLocationId', 'destinationLocationId',
      'distributedAt', 'notes', 'items']);
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
      throw new Error('VALIDATION_ERROR');
    }
    const details = items(body.items, ['lotId', 'quantity']).map((item) => ({
      lotId: id(item.lotId), quantity: string(item.quantity),
    }));
    return { data: await this.service.distribution({
      originLocationId: id(body.originLocationId),
      destinationLocationId: id(body.destinationLocationId),
      distributedAt: string(body.distributedAt), items: details,
      notes: body.notes as string | null | undefined,
      actorId: request.actor.id, idempotencyKey: key(rawKey),
    }) };
  }
}
