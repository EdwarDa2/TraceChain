import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('redirige a login cuando no hay sesión', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
});

test('rechaza credenciales inválidas', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo').fill('nadie@example.invalid');
  await page.getByLabel('Contraseña').fill('incorrecta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/correo|contraseña|credencial/i).first()).toBeVisible();
});

test('inicia sesión y cierra sesión', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: /Analista demo/ }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
