import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDashboardService,
  createLotDetailsService,
  type DashboardPorts,
  type LotDetailPorts,
} from '../../backend/src/modules/dashboard/dashboard.mts';

const lote = { id: 'lote-1', code: 'MP-001', productId: 'prd-1', productName: 'Harina' };

function puertosDashboard(): DashboardPorts {
  return {
    countLots: async () => 150,
    countProductions: async () => 60,
    countActiveIncidents: async () => 10,
    countBlockedLots: async () => 0,
    recentActivity: async (limit) => Array.from({ length: limit }, (_, i) => ({
      type: 'RECEPCION' as const, entityId: `e-${i}`, code: `MP-${i}`,
      occurredAt: '2026-11-25T20:00:00.000Z', description: 'Recepción ficticia',
    })),
    syncStatus: async () => ({ status: 'DEGRADED', sources: {}, sync: [] }),
  };
}

function puertosDetalle(sobreEscribir: Partial<LotDetailPorts> = {}): LotDetailPorts {
  return {
    lot: async () => lote,
    supplier: async () => ({ id: 'prov-1', name: 'Proveedor ficticio' }),
    stocks: async () => [{ lotId: 'lote-1', locationId: 'ub-1', physicalQuantity: '100.000' }],
    quality: async () => ({ lotId: 'lote-1', totalInspections: 1, conforming: 0, nonConforming: 1, latestInspectionId: 'ins-1' }),
    genealogy: async (_id, profundidad) => ({ status: 'COMPLETO', lots: [], metadata: { maxDepth: profundidad } }),
    incidents: async () => [{ id: 'inc-1' }],
    activeBlocks: async () => [],
    sourceStatus: async () => ({ status: 'AVAILABLE' }),
    ...sobreEscribir,
  };
}

test('dashboard summary devuelve los cuatro conteos oficiales', async () => {
  const resumen = await createDashboardService(puertosDashboard()).summary();
  assert.deepEqual(resumen, {
    totalLots: 150,
    totalProductions: 60,
    activeIncidents: 10,
    blockedLots: 0,
  });
});

test('actividad reciente valida limit 1..50 y delega', async () => {
  const servicio = createDashboardService(puertosDashboard());
  assert.equal((await servicio.recentActivity(10)).length, 10);
  await assert.rejects(() => servicio.recentActivity(0), /VALIDATION_ERROR/);
  await assert.rejects(() => servicio.recentActivity(51), /VALIDATION_ERROR/);
});

test('estado del sistema se delega sin alterarlo', async () => {
  const estado = await createDashboardService(puertosDashboard()).systemStatus();
  assert.equal(estado.status, 'DEGRADED');
});

test('detalle de lote compone todas las secciones cuando las fuentes responden', async () => {
  const detalle = await createLotDetailsService(puertosDetalle()).get('lote-1', 10);
  assert.equal(detalle.status, 'COMPLETO');
  assert.equal(detalle.lot.code, 'MP-001');
  assert.equal(detalle.stocks.status, 'COMPLETO');
  assert.equal(detalle.stocks.data?.length, 1);
  assert.equal(detalle.quality.status, 'COMPLETO');
  assert.equal(detalle.genealogy.status, 'COMPLETO');
  assert.equal(detalle.genealogy.data?.metadata.maxDepth, 10);
  assert.equal(detalle.activeBlocks.data?.length, 0);
});

test('detalle de lote marca PARCIAL y NO_DISPONIBLE si falla una fuente secundaria', async () => {
  const detalle = await createLotDetailsService(puertosDetalle({
    quality: async () => { throw new Error('MONGO_UNAVAILABLE'); },
  })).get('lote-1', 10);
  assert.equal(detalle.status, 'PARCIAL');
  assert.equal(detalle.quality.status, 'NO_DISPONIBLE');
  assert.equal(detalle.quality.data, null);
  assert.equal(detalle.quality.warnings[0]?.code, 'QUALITY_UNAVAILABLE');
  assert.equal(detalle.stocks.status, 'COMPLETO');
});

test('detalle de lote rechaza profundidad inválida y lote inexistente', async () => {
  const servicio = createLotDetailsService(puertosDetalle());
  await assert.rejects(() => servicio.get('lote-1', 0), /VALIDATION_ERROR/);
  await assert.rejects(() => servicio.get('lote-1', 21), /VALIDATION_ERROR/);
  const sinLote = createLotDetailsService(puertosDetalle({ lot: async () => null }));
  await assert.rejects(() => sinLote.get('inexistente', 10), /RESOURCE_NOT_FOUND/);
});
