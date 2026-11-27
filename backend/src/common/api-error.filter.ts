import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthError } from '../modules/auth/auth.mts';

const HTTP_ERRORS: Record<string, number> = {
  VALIDATION_ERROR: 400, IDEMPOTENCY_KEY_REQUIRED: 400,
  INVALID_CREDENTIALS: 401, UNAUTHORIZED: 401, TOKEN_EXPIRED: 401, FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404, INSUFFICIENT_STOCK: 409,
  LOT_BLOCKED: 409, LOT_EXPIRED: 409, INACTIVE_RESOURCE: 409,
  DOSSIER_PENDING: 409, INVALID_INCIDENT_TRANSITION: 409, INCIDENT_CLOSED: 409,
  BLOCK_ALREADY_ACTIVE: 409, BLOCK_ALREADY_RELEASED: 409,
  DUPLICATE_CODE: 409, IDEMPOTENCY_CONFLICT: 409,
  INVALID_QUANTITY: 422, INVALID_OPERATION: 422, INVALID_OPERATION_DATE: 422,
  INVALID_TEMPLATE: 422, INVALID_INSPECTION_PARAMETERS: 422, INVALID_REFERENCE: 422,
  LOT_NOT_IN_IMPACT: 422,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429, DATABASE_UNAVAILABLE: 503, TEMPLATE_UNAVAILABLE: 503,
  GRAPH_SYNC_PENDING: 503, GRAPH_INCONSISTENT: 503,
};

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    interface HttpResponse {
      status(value: number): HttpResponse;
      header(key: string, value: string): HttpResponse;
      json(body: unknown): void;
    }
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const raw = exception instanceof Error ? exception.message : '';
    const domainCode = exception instanceof AuthError ? exception.code : raw.split(':', 1)[0]!;
    const code = Object.hasOwn(HTTP_ERRORS, domainCode) ? domainCode
      : exception instanceof HttpException && exception.getStatus() === 413 ? 'PAYLOAD_TOO_LARGE'
      : exception instanceof HttpException && exception.getStatus() === 401 ? 'UNAUTHORIZED'
        : exception instanceof HttpException && exception.getStatus() === 403 ? 'FORBIDDEN'
          : 'INTERNAL_ERROR';
    const status = HTTP_ERRORS[code] ?? (exception instanceof HttpException
      ? exception.getStatus() : 500);
    const requestId = randomUUID();
    const outgoing = response.status(status).header('X-Request-Id', requestId);
    if (code === 'RATE_LIMITED') outgoing.header('Retry-After', '60');
    outgoing.json({
      error: { code, message: code === 'INTERNAL_ERROR' ? 'No se pudo completar la solicitud.'
        : 'La solicitud no cumple las condiciones requeridas.', details: null, requestId },
    });
  }
}
