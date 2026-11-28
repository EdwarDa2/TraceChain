import { test as base, type Page } from '@playwright/test';
import { login } from './helpers';

type WorkerFixtures = {
  analystPage: Page;
};

/**
 * Sesión compartida por worker: el backend limita los logins a 5 por minuto
 * por IP (backend/src/modules/auth/auth.mts), por lo que cada test no puede
 * autenticarse por separado. Las pruebas que necesitan otra identidad usan
 * el fixture `page` normal y hacen su propio login.
 */
export const test = base.extend<{}, WorkerFixtures>({
  analystPage: [async ({ browser }, use) => {
    const context = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    });
    const page = await context.newPage();
    await login(page, 'analista');
    await use(page);
    await context.close();
  }, { scope: 'worker' }],
});
