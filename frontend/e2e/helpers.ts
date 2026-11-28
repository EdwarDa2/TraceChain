import { expect, type Page } from '@playwright/test';

const tokens = new WeakMap<Page, string>();

export function authToken(page: Page): string {
  return tokens.get(page) ?? '';
}

export type DemoRole = 'analista' | 'operador';

const CREDENTIALS: Record<DemoRole, { email: string; password: string }> = {
  analista: { email: 'analista@example.invalid', password: 'demo-tracechain-2026' },
  operador: { email: 'operador@example.invalid', password: 'demo-tracechain-2026' },
};

/** Un solo intento: el backend limita los logins a 5 por minuto por IP. */
export async function login(page: Page, role: DemoRole = 'analista') {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await expect(page.getByLabel('Correo')).toBeVisible();
  await page.waitForFunction(() => {
    const input = document.querySelector('input');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith('__reactProps$')));
  });
  const token = new Promise<string>((resolve) => {
    page.on('response', async (response) => {
      if (response.url().includes('/auth/login') && response.request().method() === 'POST') {
        try { resolve((await response.json()).data.accessToken); } catch { /* ignorado */ }
      }
    });
  });
  const { email, password } = CREDENTIALS[role];
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  tokens.set(page, await token);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Vista general' })).toBeVisible();
}
