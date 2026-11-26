import test from 'node:test';
import assert from 'node:assert/strict';
import {
  closeIncident,
  conEstadoExpediente,
  createIncident,
  puedeEditarExpediente,
  startAnalysis,
  type Incident,
} from './incident-lifecycle.mts';

const AHORA = '2026-11-25T20:00:00Z';
const LOTE = '00000000-0000-4000-8000-000000000501';
const ANALISTA = '00000000-0000-4000-8000-000000000102';

function crear(estado: Incident['dossierStatus'] = 'PENDIENTE'): Incident {
  const incidente = createIncident({
    originLotId: LOTE,
    title: 'Impurezas en harina',
    type: 'CALIDAD',
    severity: 'ALTA',
    detectedAt: '2026-11-25T19:10:00Z',
  }, { id: '00000000-0000-4000-8000-000000001001', code: 'INC-000001' }, ANALISTA, AHORA);
  return conEstadoExpediente(incidente, estado, AHORA);
}

test('crear incidencia: ABIERTA, expediente pendiente y sin campos de cierre', () => {
  const incidente = crear();
  assert.equal(incidente.status, 'ABIERTA');
  assert.equal(incidente.dossierStatus, 'PENDIENTE');
  assert.equal(incidente.originLotId, LOTE);
  assert.equal(incidente.reportedBy, ANALISTA);
  assert.equal(incidente.closedAt, null);
  assert.equal(incidente.closedBy, null);
  assert.equal(incidente.resolution, null);
  assert.equal(incidente.createdAt, AHORA);
});

test('iniciar análisis desde ABIERTA (PM-19 parcial)', () => {
  const resultado = startAnalysis(crear(), AHORA);
  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.equal(resultado.incident.status, 'EN_ANALISIS');
    assert.equal(resultado.incident.updatedAt, AHORA);
    assert.equal(resultado.incident.closedAt, null);
  }
});

test('no se puede iniciar análisis dos veces', () => {
  const enAnalisis = crear('SINCRONIZADO');
  enAnalisis.status = 'EN_ANALISIS';
  assert.deepEqual(startAnalysis(enAnalisis, AHORA), { ok: false, code: 'INVALID_INCIDENT_TRANSITION' });
});

test('cerrar desde ABIERTA está prohibido', () => {
  assert.deepEqual(closeIncident(crear('SINCRONIZADO'), 'Resolución', ANALISTA, AHORA), {
    ok: false, code: 'INVALID_INCIDENT_TRANSITION',
  });
});

test('cerrar con expediente pendiente o en error → DOSSIER_PENDING (PM-19)', () => {
  for (const estado of ['PENDIENTE', 'ERROR'] as const) {
    const enAnalisis = crear(estado);
    enAnalisis.status = 'EN_ANALISIS';
    assert.deepEqual(closeIncident(enAnalisis, 'Resolución', ANALISTA, AHORA), {
      ok: false, code: 'DOSSIER_PENDING',
    });
  }
});

test('cerrar requiere resolución no vacía', () => {
  const enAnalisis = crear('SINCRONIZADO');
  enAnalisis.status = 'EN_ANALISIS';
  assert.deepEqual(closeIncident(enAnalisis, '   ', ANALISTA, AHORA), { ok: false, code: 'EMPTY_RESOLUTION' });
});

test('cierre válido desde EN_ANALISIS; no libera bloqueos ni cambia etapas', () => {
  const enAnalisis = crear('SINCRONIZADO');
  enAnalisis.status = 'EN_ANALISIS';
  const resultado = closeIncident(enAnalisis, 'Evaluación documentada', ANALISTA, AHORA);
  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.equal(resultado.incident.status, 'CERRADA');
    assert.equal(resultado.incident.closedAt, AHORA);
    assert.equal(resultado.incident.closedBy, ANALISTA);
    assert.equal(resultado.incident.resolution, 'Evaluación documentada');
    assert.equal(resultado.incident.dossierStatus, 'SINCRONIZADO');
    assert.equal(puedeEditarExpediente(resultado.incident), false);
  }
});

test('incidencia cerrada no se reabre ni se re-cierra (RN-66, PM-22)', () => {
  const enAnalisis = crear('SINCRONIZADO');
  enAnalisis.status = 'EN_ANALISIS';
  const cerrada = closeIncident(enAnalisis, 'Resolución', ANALISTA, AHORA);
  assert.equal(cerrada.ok, true);
  if (!cerrada.ok) return;

  assert.deepEqual(startAnalysis(cerrada.incident, AHORA), { ok: false, code: 'INCIDENT_CLOSED' });
  assert.deepEqual(closeIncident(cerrada.incident, 'Otra', ANALISTA, AHORA), { ok: false, code: 'INCIDENT_CLOSED' });
});

test('el expediente sí es editable mientras está ABIERTA o EN_ANALISIS', () => {
  assert.equal(puedeEditarExpediente(crear()), true);
  const enAnalisis = crear();
  enAnalisis.status = 'EN_ANALISIS';
  assert.equal(puedeEditarExpediente(enAnalisis), true);
});

test('conEstadoExpediente es idempotente y no altera la fecha si no hay cambio', () => {
  const incidente = crear();
  const igual = conEstadoExpediente(incidente, 'PENDIENTE', '2026-11-26T01:00:00Z');
  assert.equal(igual, incidente);
  const sincronizado = conEstadoExpediente(incidente, 'SINCRONIZADO', '2026-11-26T01:00:00Z');
  assert.equal(sincronizado.dossierStatus, 'SINCRONIZADO');
  assert.equal(sincronizado.updatedAt, '2026-11-26T01:00:00Z');
});
