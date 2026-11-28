import { expect, test } from '@playwright/test';
import { login } from './helpers';
import { test as analystTest } from './fixtures';

analystTest('el analista puede abrir investigaciones', async ({ analystPage }) => {
  await analystPage.getByRole('link', { name: 'Incidencias', exact: true }).first().click();
  await expect(analystPage.getByRole('heading', { name: 'Abrir investigación' })).toBeVisible();
});

test('el operador no puede abrir investigaciones', async ({ page }) => {
  await login(page, 'operador');
  await page.getByRole('link', { name: 'Incidencias', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Abrir investigación' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Incidencias', exact: true })).toBeVisible();
});
