import { expect } from '@playwright/test';
import { test } from './fixtures';

test('dashboard muestra KPIs, actividad y accesos con datos reales', async ({ analystPage }) => {
  await analystPage.getByRole('link', { name: 'Vista general', exact: true }).first().click();

  for (const label of ['Lotes registrados', 'Órdenes completadas',
    'Incidencias activas', 'Lotes bloqueados']) {
    await expect(analystPage.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(analystPage.getByRole('heading', { name: 'Actividad por tipo' })).toBeVisible();
  await expect(analystPage.getByRole('heading', { name: 'Actividad reciente' })).toBeVisible();
  await expect(analystPage.getByRole('heading', { name: 'Estado del sistema' })).toBeVisible();

  const values = analystPage.locator('.metric-value');
  await expect(values).toHaveCount(4);
  for (const value of await values.all()) {
    await expect(value).toHaveText(/^\d+$/);
  }
});

test('la búsqueda superior lleva al inventario filtrado', async ({ analystPage }) => {
  await analystPage.getByRole('searchbox', { name: 'Buscar lotes' }).fill('LOT-');
  await analystPage.getByRole('searchbox', { name: 'Buscar lotes' }).press('Enter');
  await expect(analystPage).toHaveURL(/\/inventory\?search=LOT-/);
  await expect(analystPage.getByRole('heading', { name: 'Inventario', exact: true })).toBeVisible();
});
