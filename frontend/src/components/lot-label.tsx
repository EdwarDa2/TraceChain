'use client';

import { useApiResponse } from '../hooks/use-api';
import type { Lot } from '../lib/types';

/** Muestra el lote recognoscible: código · producto, con el UUID en segundo plano. */
export function LotLabel({ lotId, fallback }: { lotId: string; fallback?: string }) {
  const lots = useApiResponse<Lot[]>('/lots?limit=100');
  const lot = lots.data?.data.find((item) => item.id === lotId);
  return (
    <span className="lot-label">
      <span>{lot?.code ?? fallback ?? lotId.slice(0, 8)}</span>
      {lot?.productName ? <span className="lot-label-detail">{lot.productName}</span> : null}
      <span className="lot-label-id" title={lotId}>{lotId}</span>
    </span>
  );
}
