import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { authToken } from './helpers';
import { test } from './fixtures';

const API = process.env.E2E_API_URL ?? 'http://localhost:3001/api/v1';

test('seleccionar no conformes abre la modalidad de orígenes comunes', async ({ analystPage }) => {
  const headers = { Authorization: `Bearer ${authToken(analystPage)}` };
  const lotsResponse = await analystPage.request.get(`${API}/lots?limit=100`, { headers });
  const lots = (await lotsResponse.json()).data as { id: string; productId: string }[];
  const groups = new Map<string, string[]>();
  for (const lot of lots) groups.set(lot.productId, [...(groups.get(lot.productId) ?? []), lot.id]);
  const entry = [...groups.entries()].find(([, ids]) => ids.length >= 2);
  expect(entry).toBeTruthy();
  const [productId, lotIds] = entry!;

  const templateResponse = await analystPage.request.get(
    `${API}/inspection-templates/active?productId=${productId}`, { headers });
  const template = (await templateResponse.json()).data;
  const parameters = Object.fromEntries((template.parameters ?? []).map((parameter: {
    key: string; dataType: string; options?: string[];
  }) => [parameter.key, parameter.dataType === 'BOOLEANO' ? false
    : parameter.dataType === 'ENTERO' ? 0
      : parameter.dataType === 'DECIMAL' ? '0'
        : parameter.dataType === 'SELECCION' ? parameter.options?.[0] ?? '' : 'Auditoría E2E']));

  for (const lotId of lotIds.slice(0, 2)) {
    const created = await analystPage.request.post(`${API}/inspections`, {
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      data: { lotId, templateId: template.id, templateVersion: template.version,
        inspectedAt: new Date(Date.now() - 60_000).toISOString(), parameters,
        result: 'NO_CONFORME', findings: [{ type: 'OTRO', parameter: null,
          description: 'Hallazgo E2E para análisis de orígenes', severity: 'MEDIA' }], evidence: [] },
    });
    expect(created.ok()).toBeTruthy();
  }

  await analystPage.getByRole('link', { name: 'Inspecciones', exact: true }).first().click();
  await analystPage.getByLabel('Filtrar por resultado').selectOption('NO_CONFORME');
  const boxes = analystPage.locator('input[type="checkbox"][aria-label^="Seleccionar lote"]');
  await expect(boxes.first()).toBeVisible();
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
  const origin = analystPage.getByLabel('Lote origen');
  await expect(origin).toBeVisible();
  await origin.selectOption({ index: 1 });
  await analystPage.getByRole('button', { name: 'Consultar' }).click();
  await expect(analystPage.getByRole('heading', { name: 'Resultados' })).toBeVisible();

  await analystPage.getByRole('link', { name: 'Inventario', exact: true }).first().click();
  const firstLot = analystPage.getByRole('link', { name: /^LOT-|^AUD-LOTE-/ }).first();
  await expect(firstLot).toBeVisible();
  await firstLot.click();
  await expect(analystPage).toHaveURL(/\/inventory\/[^/]+$/);
  await expect(analystPage.getByRole('heading', { name: 'Movimientos' })).toBeVisible();
});
