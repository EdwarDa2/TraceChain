import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeBlockCount,
  createBlockService,
  evaluarPertinencia,
  liberarBloque,
  lotBlocked,
  type Block,
  type BlockInput,
  type BlockStore,
  type IncidentRef,
  type Verification,
} from './block-service.mts';

const AHORA = '2026-11-25T20:00:00Z';
const ORIGEN = '00000000-0000-4000-8000-000000000501';
const DESCENDIENTE = '00000000-0000-4000-8000-000000000503';
const INDEPENDIENTE = '00000000-0000-4000-8000-000000000504';
const INCIDENTE = '00000000-0000-4000-8000-000000001001';
const ANALISTA = '00000000-0000-4000-8000-000000000102';

function bloque(lotId: string, id: string, activo = true): Block {
  return {
    id,
    lotId,
    incidentId: INCIDENTE,
    reason: 'Dependencia potencial comprobada',
    blockedBy: ANALISTA,
    blockedAt: AHORA,
    active: activo,
    releasedBy: activo ? null : ANALISTA,
    releasedAt: activo ? null : AHORA,
    releaseReason: activo ? null : 'Revisión concluida',
  };
}

function entrada(lotIds: string[] = [ORIGEN, DESCENDIENTE]): BlockInput {
  return { incidentId: INCIDENTE, originLotId: ORIGEN, lotIds, reason: 'Dependencia potencial comprobada' };
}

function incidente(status: IncidentRef['status'] = 'EN_ANALISIS'): IncidentRef {
  return { id: INCIDENTE, status };
}

function entorno(verificaciones: Record<string, Verification> = {}) {
  const mapa = new Map<string, Verification>();
  for (const [lote, estado] of Object.entries(verificaciones)) mapa.set(lote, estado as Verification);
  const mapaVerificado = mapa.size > 0 ? mapa : new Map([[DESCENDIENTE, 'YES' as Verification]]);

  const bloques: Block[] = [];
  let contador = 0;
  let fallarInsercion = false;
  const store: BlockStore = {
    activeByLotAndIncident: async (lotId, incidentId) =>
      bloques.find((b) => b.lotId === lotId && b.incidentId === incidentId && b.active) ?? null,
    createMany: async (nuevos) => {
      if (fallarInsercion) return false;
      bloques.push(...nuevos);
      return true;
    },
    findById: async (id) => bloques.find((b) => b.id === id) ?? null,
    release: async (liberado) => {
      const indice = bloques.findIndex((b) => b.id === liberado.id);
      if (indice < 0) return false;
      bloques[indice] = liberado;
      return true;
    },
    countActiveByLot: async (lotId) => bloques.filter((b) => b.lotId === lotId && b.active).length,
  };
  const service = createBlockService({
    verification: {
      verifyDescendant: async (_origen, destino) => mapaVerificado.get(destino) ?? 'UNKNOWN',
    },
    incidents: { find: async () => incidente() },
    store,
    ids: { create: () => Array.from({ length: 5 }, () => `00000000-0000-4000-8000-${String(++contador).padStart(12, '0')}`) },
  });
  return {
    service,
    bloques,
    forzarFalloInsercion: () => { fallarInsercion = true; },
  };
}

test('la raíz no requiere verificación en el grafo (RN-118)', () => {
  assert.equal(evaluarPertinencia(entrada([ORIGEN]), incidente(), new Map()), null);
});

test('descendiente verificado permite el bloqueo', () => {
  assert.equal(evaluarPertinencia(entrada(), incidente(), new Map([[DESCENDIENTE, 'YES']])), null);
});

test('negativo concluyente del grafo → LOT_NOT_IN_IMPACT (422)', () => {
  assert.equal(
    evaluarPertinencia(entrada(), incidente(), new Map([[DESCENDIENTE, 'NO']])),
    'LOT_NOT_IN_IMPACT',
  );
});

test('grafo pendiente o sin verificación → GRAPH_SYNC_PENDING (503)', () => {
  for (const estado of ['UNKNOWN', undefined] as const) {
    const mapa = estado ? new Map([[DESCENDIENTE, estado]]) : new Map();
    assert.equal(evaluarPertinencia(entrada(), incidente(), mapa), 'GRAPH_SYNC_PENDING');
  }
});

test('incidencia cerrada o ausente bloquea la operación', () => {
  assert.equal(evaluarPertinencia(entrada(), incidente('CERRADA'), new Map()), 'INCIDENT_CLOSED');
  assert.equal(evaluarPertinencia(entrada(), null, new Map()), 'RESOURCE_NOT_FOUND');
});

test('lotes vacíos, duplicados, >100 o motivo vacío → INVALID_OPERATION', () => {
  assert.equal(evaluarPertinencia(entrada([]), incidente(), new Map()), 'INVALID_OPERATION');
  assert.equal(evaluarPertinencia(entrada([ORIGEN, ORIGEN]), incidente(), new Map()), 'INVALID_OPERATION');
  const cienMas = [ORIGEN, ...Array.from({ length: 100 }, () => DESCENDIENTE)];
  assert.equal(evaluarPertinencia(entrada(cienMas), incidente(), new Map()), 'INVALID_OPERATION');
  assert.equal(evaluarPertinencia({ ...entrada([ORIGEN]), reason: '   ' }, incidente(), new Map()), 'INVALID_OPERATION');
});

test('bloquea raíz y descendiente en una sola operación', async () => {
  const ent = entorno();
  const resultado = await ent.service.block(entrada(), ANALISTA, AHORA);
  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.equal(resultado.blocks.length, 2);
    assert.deepEqual(resultado.blocks.map((b) => b.lotId), [ORIGEN, DESCENDIENTE]);
    assert.equal(resultado.blocks.every((b) => b.active && b.releasedBy === null), true);
    assert.equal(resultado.blocks[0]!.incidentId, INCIDENTE);
    assert.equal(Object.keys(resultado.blocks[0]!).includes('quantity'), false);
  }
  assert.equal(ent.bloques.length, 2);
});

test('si un lote no es impactado, no se crea ningún bloqueo (todo o nada)', async () => {
  const ent = entorno({ [INDEPENDIENTE]: 'NO' });
  const resultado = await ent.service.block(entrada([ORIGEN, INDEPENDIENTE]), ANALISTA, AHORA);
  assert.deepEqual(resultado, { ok: false, code: 'LOT_NOT_IN_IMPACT' });
  assert.equal(ent.bloques.length, 0);
});

test('grafo pendiente impide bloquear sin escribir', async () => {
  const ent = entorno({ [INDEPENDIENTE]: 'UNKNOWN' });
  const resultado = await ent.service.block(entrada([ORIGEN, INDEPENDIENTE]), ANALISTA, AHORA);
  assert.deepEqual(resultado, { ok: false, code: 'GRAPH_SYNC_PENDING' });
  assert.equal(ent.bloques.length, 0);
});

test('no se pueden duplicar bloqueos activos por lote e incidencia', async () => {
  const ent = entorno();
  await ent.service.block(entrada([ORIGEN]), ANALISTA, AHORA);
  const resultado = await ent.service.block(entrada([ORIGEN]), ANALISTA, AHORA);
  assert.deepEqual(resultado, { ok: false, code: 'BLOCK_ALREADY_ACTIVE' });
  assert.equal(ent.bloques.length, 1);
});

test('fallo de inserción se reporta como conflicto, sin bloqueos parciales', async () => {
  const ent = entorno();
  ent.forzarFalloInsercion();
  const resultado = await ent.service.block(entrada(), ANALISTA, AHORA);
  assert.deepEqual(resultado, { ok: false, code: 'BLOCK_ALREADY_ACTIVE' });
  assert.equal(ent.bloques.length, 0);
});

test('liberar bloqueo activo registra usuario, fecha y motivo', async () => {
  const ent = entorno();
  await ent.service.block(entrada([ORIGEN]), ANALISTA, AHORA);
  const id = ent.bloques[0]!.id;
  const resultado = await ent.service.release(id, 'Revisión concluida', ANALISTA, '2026-11-26T01:00:00Z');
  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.deepEqual(resultado.result, {
      blockId: id, active: false, lotId: ORIGEN, lotBlocked: false, remainingActiveBlocks: 0,
    });
  }
  assert.equal(ent.bloques[0]!.releasedBy, ANALISTA);
  assert.equal(ent.bloques[0]!.releasedAt, '2026-11-26T01:00:00Z');
  assert.equal(ent.bloques[0]!.releaseReason, 'Revisión concluida');
});

test('liberar bloqueo ya liberado → BLOCK_ALREADY_RELEASED', async () => {
  const inactivo = bloque(ORIGEN, '00000000-0000-4000-8000-000000000001', false);
  assert.deepEqual(liberarBloque(inactivo, 'x', ANALISTA, AHORA), { ok: false, code: 'BLOCK_ALREADY_RELEASED' });
  assert.deepEqual(liberarBloque(null, 'x', ANALISTA, AHORA), { ok: false, code: 'RESOURCE_NOT_FOUND' });
  assert.deepEqual(liberarBloque(bloque(ORIGEN, 'b'), '  ', ANALISTA, AHORA), { ok: false, code: 'INVALID_OPERATION' });
});

test('otra incidencia mantiene el lote bloqueado tras liberar una (TP-17)', () => {
  const primera = bloque(ORIGEN, 'b1');
  const segunda = { ...bloque(ORIGEN, 'b2'), incidentId: '00000000-0000-4000-8000-000000009999' };
  const lista = [primera, segunda];
  assert.equal(activeBlockCount(lista, ORIGEN), 2);
  assert.equal(lotBlocked(lista, ORIGEN), true);
  const liberada = liberarBloque(primera, 'Motivo', ANALISTA, AHORA);
  assert.equal(liberada.ok, true);
  if (liberada.ok) {
    const restante = lista.map((b) => (b.id === liberada.block.id ? liberada.block : b));
    assert.equal(activeBlockCount(restante, ORIGEN), 1);
    assert.equal(lotBlocked(restante, ORIGEN), true);
  }
});
