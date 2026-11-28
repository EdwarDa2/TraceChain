'use client';

import { CatalogPage } from '../../../features/catalogs/catalog-page';

export default function SuppliersPage() {
  return <CatalogPage config={{
    title: 'Proveedores',
    description: 'Catálogo de proveedores de materia prima.',
    path: 'suppliers',
    fields: [{ key: 'code', label: 'Código' }, { key: 'name', label: 'Nombre' }],
  }} />;
}
