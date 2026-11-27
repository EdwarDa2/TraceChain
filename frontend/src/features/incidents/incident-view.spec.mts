import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accionesPermitidas,
  etiquetaEstado,
  etiquetaSincronizacion,
  requiereConfirmacion,
  type VistaIncidente,
} from './incident-view.mts';

const vista = (status: VistaIncidente['status'], dossierStatus: VistaIncidente['dossierStatus'], bloqueos = false): VistaIncidente => ({
  status, dossierStatus, tieneBloqueosActivos: bloqueos,
});

test('operador solo ve impacto, nunca edita ni cierra (RN-11, PS-04/06/07)', () => {
  assert.deepEqual(accionesPermitidas(vista('ABIERTA', 'PENDIENTE'), 'OPERADOR'), ['VER_IMPACTO']);
  assert.deepEqual(accionesPermitidas(vista('EN_ANALISIS', 'SINCRONIZADO', true), 'OPERADOR'), ['VER_IMPACTO']);
});

test('analista en ABIERTA puede editar expediente e iniciar análisis', () => {
  assert.deepEqual(accionesPermitidas(vista('ABIERTA', 'PENDIENTE'), 'ANALISTA_CALIDAD'), [
    'VER_IMPACTO', 'EDITAR_EXPEDIENTE', 'INICIAR_ANALISIS',
  ]);
});

test('cerrar exige expediente sincronizado (PM-19)', () => {
  const pendiente = accionesPermitidas(vista('EN_ANALISIS', 'PENDIENTE'), 'ANALISTA_CALIDAD');
  assert.equal(pendiente.includes('CERRAR'), false);
  assert.equal(pendiente.includes('EDITAR_EXPEDIENTE'), true);

  const listo = accionesPermitidas(vista('EN_ANALISIS', 'SINCRONIZADO'), 'ANALISTA_CALIDAD');
  assert.equal(listo.includes('CERRAR'), true);
  assert.equal(listo.includes('INICIAR_ANALISIS'), false);
});

test('incidencia cerrada permite liberar bloqueos pero no reabrir ni editar', () => {
  const acciones = accionesPermitidas(vista('CERRADA', 'SINCRONIZADO', true), 'ANALISTA_CALIDAD');
  assert.deepEqual(acciones, ['VER_IMPACTO', 'LIBERAR']);
  assert.equal(acciones.includes('BLOQUEAR'), false);
  assert.equal(acciones.includes('CERRAR'), false);
});

test('sin bloqueos activos no se ofrece LIBERAR', () => {
  assert.equal(accionesPermitidas(vista('CERRADA', 'SINCRONIZADO'), 'ANALISTA_CALIDAD').includes('LIBERAR'), false);
});

test('etiquetas en español y estados de sincronización', () => {
  assert.equal(etiquetaEstado('EN_ANALISIS'), 'En análisis');
  assert.equal(etiquetaEstado('CERRADA'), 'Cerrada');
  assert.equal(etiquetaSincronizacion('PENDIENTE'), 'Expediente pendiente');
  assert.equal(etiquetaSincronizacion('ERROR'), 'Expediente con error');
});

test('confirmación para mutaciones sensibles', () => {
  assert.equal(requiereConfirmacion('CERRAR'), true);
  assert.equal(requiereConfirmacion('BLOQUEAR'), true);
  assert.equal(requiereConfirmacion('LIBERAR'), true);
  assert.equal(requiereConfirmacion('VER_IMPACTO'), false);
  assert.equal(requiereConfirmacion('EDITAR_EXPEDIENTE'), false);
});
