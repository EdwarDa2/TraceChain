'use client';

import { CatalogPage } from '../../../features/catalogs/catalog-page';

export default function ProductsPage() {
  return <CatalogPage config={{
    title: 'Productos',
    description: 'Catálogo con tipo y unidad fija.',
    path: 'products',
    fields: [
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Nombre' },
      { key: 'type', label: 'Tipo', options: ['MATERIA_PRIMA', 'INTERMEDIO', 'TERMINADO'] },
      { key: 'unit', label: 'Unidad', options: ['KG', 'G', 'L', 'ML', 'UNIDAD'] },
    ],
  }} />;
}
