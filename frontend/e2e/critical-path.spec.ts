import { expect } from '@playwright/test';
import { test } from './fixtures';

test('seleccionar no conformes abre la modalidad de orígenes comunes', async ({ analystPage }) => {
  await analystPage.getByRole('link', { name: 'Inspecciones', exact: true }).first().click();
  await analystPage.getByLabel('Filtrar por resultado').selectOption('NO_CONFORME');
  const boxes = analystPage.locator('input[type="checkbox"][aria-label^="Seleccionar lote"]');
  const count = await boxes.count();
  if (count < 2) test.skip(true, 'el entorno no tiene dos lotes no conformes');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await analystPage.getByRole('button', { name: 'Analizar selección' }).click();
  await expect(analystPage).toHaveURL(/mode=COMMON_ORIGINS/);
  await expect(analystPage.getByRole('button', { name: 'Comunes', exact: true }))
    .toHaveAttribute('data-active', 'true');
});

test('recorrido crítico: incidencia → impacto → trazabilidad → detalle de lote', async ({ analystPage }) => {
  await analystPage.getByRole('link', { name: 'Incidencias', exact: true }).first().click();
  await expect(analystPage.getByRole('heading', { name: 'Incidencias', exact: true })).toBeVisible();

  const firstIncident = analystPage.getByRole('link', { name: /^INC-/ }).first();
  await expect(firstIncident).toBeVisible();
  await firstIncident.click();
  await expect(analystPage.getByRole('link', { name: 'Ver impacto' })).toBeVisible();
  await analystPage.getByRole('link', { name: 'Ver impacto' }).click();
  await expect(analystPage.getByRole('heading', { name: 'Impacto potencial' })).toBeVisible();
  expect(analystPage.url()).toMatch(/\/incidents\/[^/]+\/impact$/);

  await analystPage.getByRole('link', { name: 'Trazabilidad', exact: true }).first().click();
  await expect(analystPage.getByLabel('Lote origen')).toBeVisible();
  await analystPage.getByRole('button', { name: 'Consultar' }).click();
  await expect(analystPage.getByRole('heading', { name: 'Resultados' })).toBeVisible();

  await analystPage.getByRole('link', { name: 'Inventario', exact: true }).first().click();
  const firstLot = analystPage.getByRole('link', { name: /^LOT-|^AUD-LOTE-/ }).first();
  await expect(firstLot).toBeVisible();
  await firstLot.click();
  await expect(analystPage).toHaveURL(/\/inventory\/[^/]+$/);
  await expect(analystPage.getByRole('heading', { name: /Lote/ }).first()).toBeVisible();
});
