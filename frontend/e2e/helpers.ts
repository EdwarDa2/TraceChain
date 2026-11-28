import { expect, type Page } from '@playwright/test';

export type DemoRole = 'analista' | 'operador';

const CREDENTIALS: Record<DemoRole, { email: string; password: string }> = {
  analista: { email: 'analista@example.invalid', password: 'demo-tracechain-2026' },
  operador: { email: 'operador@example.invalid', password: 'demo-tracechain-2026' },
};

export async function login(page: Page, role: DemoRole = 'analista') {
  const { email, password } = CREDENTIALS[role];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await expect(page.getByLabel('Correo')).toBeVisible();
    await page.waitForFunction(() => {
      const input = document.querySelector('input');
      return Boolean(input && Object.keys(input).some((key) => key.startsWith('__reactProps$')));
    });
    await page.waitForTimeout(700);
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    try {
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: 'Vista general' })).toBeVisible();
      return;
    } catch {
      if (attempt === 2) throw new Error(`No se pudo iniciar sesión como ${role}`);
    }
  }
}
