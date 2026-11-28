'use client';

import { CatalogPage } from '../../../features/catalogs/catalog-page';

export default function LocationsPage() {
  return <CatalogPage config={{
    title: 'Ubicaciones',
    description: 'Planta y sucursales de la red ficticia.',
    path: 'locations',
    fields: [
      { key: 'code', label: 'Código' },
      { key: 'name', label: 'Nombre' },
      { key: 'type', label: 'Tipo', options: ['ALMACEN', 'PLANTA_PRODUCCION', 'SUCURSAL'] },
    ],
  }} />;
}
