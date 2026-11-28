'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api, apiResponse, idempotencyKey } from '../lib/api';
import { useAuth } from '../providers/auth-provider';

export function useApiQuery<T>(path: string | null, enabled = true,
  options?: Partial<UseQueryOptions<T>>) {
  const { token } = useAuth();
  return useQuery<T>({
    queryKey: [path, token],
    queryFn: () => api<T>(path as string, token),
    enabled: Boolean(path && token && enabled),
    ...options,
  });
}

/** Para endpoints de lista que devuelven `{ data, meta }` sin desenvueltos. */
export function useApiResponse<T>(path: string | null, enabled = true) {
  const { token } = useAuth();
  return useQuery<{ data: T; meta?: { total: number; page: number; limit: number } }>({
    queryKey: [path, token, 'envelope'],
    queryFn: () => apiResponse<T>(path as string, token),
    enabled: Boolean(path && token && enabled),
  });
}

export function useApiMutation<T>() {
  const { token } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, body, method = 'POST', idempotent = false }: {
      path: string; body?: unknown; method?: 'GET' | 'POST' | 'PATCH'; idempotent?: boolean;
    }) => api<T>(path, token, {
      method,
      ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
      headers: idempotent ? { 'Idempotency-Key': idempotencyKey() } : undefined,
    }),
    onSuccess: () => client.invalidateQueries(),
  });
}
