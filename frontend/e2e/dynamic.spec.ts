import { expect } from '@playwright/test';
import { test } from './fixtures';

test('el operador crea un proveedor nuevo y lo consulta desde la tabla', async ({ operatorPage }) => {
  const code = `E2E-PROV-${Date.now().toString().slice(-8)}`;
  await operatorPage.getByRole('link', { name: 'Proveedores', exact: true }).first().click();
  await expect(operatorPage.getByRole('heading', { name: 'Proveedores' })).toBeVisible();
  await operatorPage.getByRole('button', { name: 'Nuevo registro' }).click();
  await operatorPage.getByLabel('Código').fill(code);
  await operatorPage.getByLabel('Nombre').fill('Proveedor E2E dinámico');
  await operatorPage.getByRole('button', { name: 'Guardar' }).click();
  await expect(operatorPage.getByRole('button', { name: 'Nuevo registro' })).toBeVisible();

  await operatorPage.getByPlaceholder('Buscar en proveedores').fill(code);
  await expect(operatorPage.getByRole('cell', { name: code, exact: true })).toBeVisible();
  await expect(operatorPage.getByRole('cell', { name: 'Proveedor E2E dinámico' })).toBeVisible();
});
