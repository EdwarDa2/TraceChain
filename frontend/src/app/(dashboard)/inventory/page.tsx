'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DataTable, ErrorState, LoadingState, PageHeader, QuantityDisplay, SearchInput, StatusBadge } from '../../../components/ui';
import { useApiQuery } from '../../../hooks/use-api';
import type { Lot } from '../../../lib/types';

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const query = useApiQuery<{ data: Lot[] }>(`/lots?search=${encodeURIComponent(search)}&limit=100`);
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} />;
  return (
    <>
      <PageHeader title="Inventario" description="Lotes, saldos físicos y utilizables." />
      <div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Buscar lote" /></div>
      <DataTable columns={[
        { key: 'code', label: 'Lote', render: (row) =>
          <Link href={`/inventory/${row.id}`}>{row.code}</Link> },
        { key: 'productName', label: 'Producto' },
        { key: 'originType', label: 'Origen' },
        { key: 'physicalQuantity', label: 'Físico',
          render: (row) => <QuantityDisplay value={row.physicalQuantity} unit={row.unit} /> },
        { key: 'usableQuantity', label: 'Utilizable',
          render: (row) => <QuantityDisplay value={row.usableQuantity} unit={row.unit} /> },
        { key: 'graphSyncStatus', label: 'Grafo', render: (row) => <StatusBadge status={row.graphSyncStatus} /> },
      ]} rows={query.data?.data ?? []} empty="No hay lotes registrados." />
    </>
  );
}
