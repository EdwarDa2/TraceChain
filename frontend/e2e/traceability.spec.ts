import { expect } from '@playwright/test';
import { test } from './fixtures';

test('consulta de trazabilidad muestra grafo y resultados con un lote real', async ({ analystPage }) => {
  await analystPage.getByRole('link', { name: 'Trazabilidad', exact: true }).first().click();
  await expect(analystPage.getByRole('heading', { name: 'Trazabilidad' })).toBeVisible();

  const lotSelect = analystPage.getByLabel('Lote origen');
  await expect.poll(() => lotSelect.locator('option').count()).toBeGreaterThan(1);
  await lotSelect.selectOption({ index: 1 });
  await analystPage.getByLabel('Profundidad').fill('1');
  await analystPage.getByRole('button', { name: 'Consultar' }).click();

  await expect(analystPage.getByRole('heading', { name: 'Resultados' })).toBeVisible();
  await expect(analystPage.locator('.graph-canvas')).toBeVisible();
  await expect(analystPage.getByText(/COMPLETO|PARCIAL|VACIO|NO_DISPONIBLE/).first()).toBeVisible();
});

test('el analista ve la modalidad de orígenes comunes', async ({ analystPage }) => {
  await analystPage.getByRole('link', { name: 'Trazabilidad', exact: true }).first().click();
  await expect(analystPage.getByRole('button', { name: 'Comunes', exact: true })).toBeVisible();
});
