import { expect } from '@playwright/test';
import { test } from './fixtures';

test('el analista puede abrir investigaciones', async ({ analystPage }) => {
  await analystPage.getByRole('link', { name: 'Incidencias', exact: true }).first().click();
  await expect(analystPage.getByRole('heading', { name: 'Abrir investigación' })).toBeVisible();
});

test('el operador no puede abrir investigaciones', async ({ operatorPage }) => {
  await operatorPage.getByRole('link', { name: 'Incidencias', exact: true }).first().click();
  await expect(operatorPage.getByRole('heading', { name: 'Abrir investigación' })).toHaveCount(0);
  await expect(operatorPage.getByRole('heading', { name: 'Incidencias', exact: true })).toBeVisible();
});
