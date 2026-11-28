import { expect } from '@playwright/test';
import { test } from './fixtures';

const VIEWS: [string, string][] = [
  ['Vista general', 'Vista general'],
  ['Inventario', 'Inventario'],
  ['Producción', 'Producción'],
  ['Distribución', 'Distribución'],
  ['Inspecciones', 'Inspecciones'],
  ['Incidencias', 'Incidencias'],
  ['Trazabilidad', 'Trazabilidad'],
  ['Proveedores', 'Proveedores'],
  ['Productos', 'Productos'],
  ['Ubicaciones', 'Ubicaciones'],
];

for (const [link, heading] of VIEWS) {
  test(`navega a ${link} y muestra su cabecera`, async ({ analystPage }) => {
    await analystPage.getByRole('link', { name: link, exact: true }).first().click();
    await expect(analystPage.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
  });
}
