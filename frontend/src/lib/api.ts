export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export type ApiEnvelope<T> = { data: T; meta?: { total: number; page: number; limit: number } };

export async function apiResponse<T>(path: string, token?: string | null,
  init?: RequestInit): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } }).error;
    throw new ApiError(response.status, error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'No se pudo completar la solicitud.');
  }
  return body as ApiEnvelope<T>;
}

export async function api<T>(path: string, token?: string | null, init?: RequestInit): Promise<T> {
  return (await apiResponse<T>(path, token, init)).data;
}

export function idempotencyKey(): string {
  return crypto.randomUUID();
}
