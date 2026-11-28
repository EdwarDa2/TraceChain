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

test('el analista crea una incidencia sin inspección desde el formulario', async ({ analystPage }) => {
  await analystPage.getByRole('link', { name: 'Incidencias', exact: true }).first().click();
  const origin = analystPage.getByLabel('Lote origen');
  await expect.poll(() => origin.locator('option').count()).toBeGreaterThan(1);
  await origin.selectOption({ index: 1 });

  const title = `Incidencia E2E ${Date.now().toString().slice(-8)}`;
  await analystPage.getByLabel('Título').fill(title);
  await analystPage.getByLabel('Descripción').fill('Creada por prueba E2E sin inspección previa');
  await analystPage.getByRole('button', { name: 'Abrir incidencia' }).click();

  await expect(analystPage.getByText(/Incidencia INC-\d+ creada/)).toBeVisible();
  await expect(analystPage.getByRole('cell', { name: title })).toBeVisible();
});
