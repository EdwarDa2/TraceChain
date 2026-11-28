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
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await analystPage.getByRole('link', { name: link, exact: true }).first().click();
      try {
        await expect(analystPage.getByRole('heading', { name: heading, exact: true }).first())
          .toBeVisible({ timeout: 8_000 });
        return;
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
  });
}
