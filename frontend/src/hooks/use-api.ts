'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api, idempotencyKey } from '../lib/api';
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

export function useApiMutation<T>() {
  const { token } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, body, method = 'POST', idempotent = false }: {
      path: string; body?: unknown; method?: 'POST' | 'PATCH'; idempotent?: boolean;
    }) => api<T>(path, token, {
      method,
      body: JSON.stringify(body ?? {}),
      headers: idempotent ? { 'Idempotency-Key': idempotencyKey() } : undefined,
    }),
    onSuccess: () => client.invalidateQueries(),
  });
}
