import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDossierPatch,
  applyMongoEvent,
  createDossier,
  createDossierRepository,
  toDossierAccepted,
  type Dossier,
  type DossierFields,
  type DossierStore,
  type ExpedienteActualizadoEvent,
  type IncidenciaRegistradaEvent,
} from './dossier.mts';

const NOW = '2026-11-25T20:00:00Z';
const IDS = {
  incident: '00000000-0000-4000-8000-000000001001',
  dossier: '00000000-0000-4000-8000-000000001101',
  insp1: '00000000-0000-4000-8000-000000000901',
  insp2: '00000000-0000-4000-8000-000000000902',
  event1: '11111111-1111-4111-8111-111111111111',
  event2: '22222222-2222-4222-8222-222222222222',
};

const fields: DossierFields = {
  description: 'Investigación ficticia',
  inspectionIds: [IDS.insp1],
  findings: [{ type: 'APARIENCIA', parameter: null, description: 'Hallazgo ficticio', severity: 'MEDIA' }],
  evidence: [{ type: 'REFERENCIA', reference: 'REF-1', description: 'Dato ficticio', registeredAt: '2020-01-01T00:00:00Z' }],
  notes: null,
  detailedResolution: null,
};

function crearEvento(eventId = IDS.event1): IncidenciaRegistradaEvent {
  return {
    eventId,
    eventType: 'INCIDENCIA_REGISTRADA',
    payloadVersion: 1,
    occurredAt: NOW,
    payload: { incidentId: IDS.incident, dossierId: IDS.dossier, version: 1, fields },
  };
}

function actualizarEvento(
  eventId: string,
  expectedVersion: number,
  changes: Partial<DossierFields>,
): ExpedienteActualizadoEvent {
  return {
    eventId,
    eventType: 'EXPEDIENTE_ACTUALIZADO',
    payloadVersion: 1,
    occurredAt: NOW,
    payload: {
      incidentId: IDS.incident,
      expectedVersion,
      nextVersion: expectedVersion + 1,
      changes,
    },
  };
}

function almacen(inicial: Dossier | null = null) {
  let actual = inicial;
  let inserciones = 0;
  let cas = 0;
  const store: DossierStore = {
    findByIncident: async () => actual,
    insert: async (dossier) => {
      inserciones += 1;
      if (actual !== null) return false;
      actual = dossier;
      return true;
    },
    cas: async (_incidentId, expectedVersion, dossier) => {
      cas += 1;
      if (actual === null || actual.version !== expectedVersion) return false;
      actual = dossier;
      return true;
    },
  };
  return {
    store,
    actual: () => actual,
    inserciones: () => inserciones,
    cas: () => cas,
    fijar: (dossier: Dossier | null) => { actual = dossier; },
  };
}

test('crea expediente v1 desde INCIDENCIA_REGISTRADA con fechas de servidor', () => {
  const dossier = createDossier(crearEvento(), NOW);
  assert.equal(dossier.id, IDS.dossier);
  assert.equal(dossier.incidentId, IDS.incident);
  assert.equal(dossier.version, 1);
  assert.equal(dossier.ultimoEventoId, IDS.event1);
  assert.equal(dossier.createdAt, NOW);
  assert.equal(dossier.updatedAt, NOW);
  assert.equal(dossier.evidence[0]!.registeredAt, NOW);
  assert.notEqual(dossier.evidence[0]!.registeredAt, '2020-01-01T00:00:00Z');
  assert.deepEqual(dossier.inspectionIds, [IDS.insp1]);
});

test('replay del evento de creación no duplica versión (PM-15)', () => {
  const inicial = createDossier(crearEvento(), NOW);
  const resultado = applyMongoEvent(inicial, crearEvento(), '2026-11-26T01:00:00Z');
  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.equal(resultado.replayed, true);
    assert.equal(resultado.dossier.version, 1);
    assert.equal(resultado.dossier.updatedAt, NOW);
  }
});

test('CAS con expectedVersion correcto incrementa versión y reemplaza arreglos (PM-13)', () => {
  const inicial = createDossier(crearEvento(), NOW);
  const resultado = applyDossierPatch(inicial, {
    expectedVersion: 1,
    description: 'Descripción actualizada',
    inspectionIds: [IDS.insp1, IDS.insp2],
    evidence: [{ type: 'DOCUMENTO', reference: 'DOC-2' }],
    detailedResolution: null,
  }, IDS.event2, '2026-11-26T02:00:00Z');

  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.equal(resultado.currentVersion, 1);
    assert.equal(resultado.nextVersion, 2);
    assert.equal(resultado.dossier.version, 2);
    assert.equal(resultado.dossier.ultimoEventoId, IDS.event2);
    assert.deepEqual(resultado.dossier.inspectionIds, [IDS.insp1, IDS.insp2]);
    assert.equal(resultado.dossier.evidence[0]!.description, null);
    assert.equal(resultado.dossier.evidence[0]!.registeredAt, '2026-11-26T02:00:00Z');
    assert.equal(resultado.dossier.findings.length, 1);
  }
});

test('campos omitidos permanecen intactos; null limpia campos anulables', () => {
  const inicial = createDossier(crearEvento(), NOW);
  const conNota = applyDossierPatch(inicial, { expectedVersion: 1, notes: 'Nota ficticia' }, IDS.event2, NOW);
  assert.equal(conNota.ok, true);
  if (!conNota.ok) return;

  const limpio = applyDossierPatch(conNota.dossier, { expectedVersion: 2, notes: null }, IDS.event1, NOW);
  assert.equal(limpio.ok, true);
  if (limpio.ok) {
    assert.equal(limpio.dossier.notes, null);
    assert.equal(limpio.dossier.description, fields.description);
    assert.deepEqual(limpio.dossier.findings, fields.findings);
  }
});

test('expectedVersion incorrecto produce VERSION_CONFLICT sin escribir (PM-16)', () => {
  const inicial = createDossier(crearEvento(), NOW);
  const resultado = applyDossierPatch(inicial, { expectedVersion: 5, notes: 'x' }, IDS.event2, NOW);
  assert.deepEqual(resultado, { ok: false, code: 'VERSION_CONFLICT' });
});

test('patch sin campos mutables es rechazado', () => {
  const inicial = createDossier(crearEvento(), NOW);
  const resultado = applyDossierPatch(inicial, { expectedVersion: 1 }, IDS.event2, NOW);
  assert.deepEqual(resultado, { ok: false, code: 'INVALID_PATCH' });
});

test('referencias duplicadas y límites documentales', () => {
  const inicial = createDossier(crearEvento(), NOW);
  const duplicado = applyDossierPatch(inicial, {
    expectedVersion: 1, inspectionIds: [IDS.insp1, IDS.insp1],
  }, IDS.event2, NOW);
  assert.deepEqual(duplicado, { ok: false, code: 'DUPLICATE_REFERENCE' });

  const exceso = applyDossierPatch(inicial, {
    expectedVersion: 1,
    inspectionIds: Array.from({ length: 51 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`),
  }, IDS.event2, NOW);
  assert.deepEqual(exceso, { ok: false, code: 'LIMIT_EXCEEDED' });
});

test('replay por ultimoEventoId ignora expectedVersion obsoleto', () => {
  const inicial = createDossier(crearEvento(), NOW);
  const resultado = applyDossierPatch(inicial, { expectedVersion: 99, notes: 'x' }, IDS.event1, NOW);
  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.equal(resultado.replayed, true);
    assert.equal(resultado.dossier.version, 1);
  }
});

test('EXPEDIENTE_ACTUALIZADO rechaza eventos incoherentes (PM-21)', () => {
  const inicial = createDossier(crearEvento(), NOW);
  const inconsistente = { ...actualizarEvento(IDS.event2, 1, { notes: 'x' }), payload: { ...actualizarEvento(IDS.event2, 1, { notes: 'x' }).payload, nextVersion: 5 } };
  assert.deepEqual(applyMongoEvent(inicial, inconsistente, NOW), { ok: false, code: 'EVENT_MISMATCH' });

  const otroIncidente = { ...actualizarEvento(IDS.event2, 1, { notes: 'x' }) };
  otroIncidente.payload.incidentId = '00000000-0000-4000-8000-000000009999';
  assert.deepEqual(applyMongoEvent(inicial, otroIncidente, NOW), { ok: false, code: 'EVENT_MISMATCH' });
});

test('repositorio: ensureCreated inserta una vez y reprocesa sin duplicar', async () => {
  const mem = almacen();
  const repo = createDossierRepository(mem.store);
  const primero = await repo.ensureCreated(crearEvento(), NOW);
  const segundo = await repo.ensureCreated(crearEvento(), '2026-11-26T03:00:00Z');
  assert.equal(primero.ok, true);
  assert.equal(segundo.ok, true);
  if (segundo.ok) assert.equal(segundo.replayed, true);
  assert.equal(mem.inserciones(), 1);
  assert.equal(mem.actual()?.version, 1);
});

test('repositorio: carrera de inserción recupera el documento ganador', async () => {
  const ganador = createDossier(crearEvento(), NOW);
  let lecturas = 0;
  let inserciones = 0;
  const store: DossierStore = {
    findByIncident: async () => {
      lecturas += 1;
      return lecturas === 1 ? null : ganador;
    },
    insert: async () => {
      inserciones += 1;
      return false; // UQ(incidencia_id) ganada por otro worker
    },
    cas: async () => false,
  };
  const repo = createDossierRepository(store);
  const resultado = await repo.ensureCreated(crearEvento(), NOW);
  assert.equal(resultado.ok, true);
  if (resultado.ok) assert.equal(resultado.replayed, true);
  assert.equal(inserciones, 1);
  assert.equal(lecturas, 2);
});

test('repositorio: CAS fallido con evento ya aplicado se considera replay', async () => {
  const inicial = createDossier(crearEvento(), NOW);
  const mem = almacen(inicial);
  mem.store.cas = async () => false;
  const repo = createDossierRepository(mem.store);
  const patch = { expectedVersion: 1, notes: 'x' };

  const directo = applyDossierPatch(inicial, patch, IDS.event2, NOW);
  assert.equal(directo.ok, true);
  if (directo.ok) mem.fijar({ ...directo.dossier, ultimoEventoId: IDS.event2 });

  const resultado = await repo.update(IDS.incident, patch, IDS.event2, NOW);
  assert.equal(resultado.ok, true);
  if (resultado.ok) assert.equal(resultado.replayed, true);
  assert.equal(mem.actual()?.version, 2);
});

test('repositorio: CAS fallido sin evento aplicado reporta VERSION_CONFLICT (PM-19)', async () => {
  const inicial = createDossier(crearEvento(), NOW);
  const mem = almacen(inicial);
  mem.store.cas = async () => false;
  const repo = createDossierRepository(mem.store);
  const resultado = await repo.update(IDS.incident, { expectedVersion: 1, notes: 'x' }, IDS.event2, NOW);
  assert.deepEqual(resultado, { ok: false, code: 'VERSION_CONFLICT' });
});

test('respuesta 202 usa nextVersion como expectedVersion (API_CONTRACT §9)', () => {
  const inicial = createDossier(crearEvento(), NOW);
  const resultado = applyDossierPatch(inicial, { expectedVersion: 1, notes: 'x' }, IDS.event2, NOW);
  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.deepEqual(toDossierAccepted(resultado, IDS.incident), {
      incidentId: IDS.incident,
      currentVersion: 1,
      expectedVersion: 2,
      dossierStatus: 'PENDIENTE',
    });
  }
});
