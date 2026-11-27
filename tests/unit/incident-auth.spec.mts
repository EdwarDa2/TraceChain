import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIncidentRepository,
  createBlockRepository,
  type IncidentCreation,
} from '../../backend/src/database/postgres/incident-repositories.mts';
import {
  AuthError,
  createLoginLimiter,
  requireRole,
  signJwt,
  verifyJwt,
} from '../../backend/src/modules/auth/auth.mts';
import type { PgClientLike, Tx } from '../../backend/src/database/postgres/transaction.mts';

class ClienteFalso implements PgClientLike {
  llamadas: { sql: string; parametros?: unknown[] }[] = [];
  filas: Record<string, unknown>[] = [];
  filasPor?: (sql: string, parametros?: unknown[]) => Record<string, unknown>[];
  forzarRowCount: number | null = null;

  async query(sql: string, parametros?: unknown[]) {
    this.llamadas.push({ sql, parametros });
    const filas = this.filasPor?.(sql, parametros) ?? this.filas;
    return { rows: filas, rowCount: this.forzarRowCount ?? filas.length };
  }
  async release() {}
}

const txDe = (cliente: ClienteFalso): Tx => ({ query: (sql, parametros) => cliente.query(sql, parametros) });

const incidenciaCreada: Record<string, unknown> = {
  id: 'inc-1',
  codigo: 'INC-000001',
  lote_origen_id: 'lote-1',
  titulo: 'Impurezas',
  tipo: 'CALIDAD',
  severidad: 'ALTA',
  estado: 'ABIERTA',
  estado_expediente: 'PENDIENTE',
  reportado_por: 'analista-1',
  fecha_deteccion: '2026-11-25T19:00:00.000Z',
  created_at: '2026-11-25T20:00:00.000Z',
  updated_at: '2026-11-25T20:00:00.000Z',
  fecha_cierre: null,
  cerrado_por: null,
  resolucion: null,
};

const creacion: IncidentCreation = {
  id: 'inc-1',
  code: 'INC-000001',
  originLotId: 'lote-1',
  title: 'Impurezas',
  type: 'CALIDAD',
  severity: 'ALTA',
  detectedAt: '2026-11-25T19:00:00.000Z',
  reportedBy: 'analista-1',
};

test('REL-03: crear incidencia deja estado ABIERTA y expediente PENDIENTE', async () => {
  const cliente = new ClienteFalso();
  cliente.filasPor = (sql) => sql.includes('INSERT INTO incidencias') ? [incidenciaCreada] : [];
  const incidente = await createIncidentRepository().create(creacion, txDe(cliente));
  assert.equal(incidente.status, 'ABIERTA');
  assert.equal(incidente.dossierStatus, 'PENDIENTE');
  const insercion = cliente.llamadas.find((llamada) => llamada.sql.includes('INSERT INTO incidencias'))!;
  assert.equal(insercion.parametros?.[6], 'ABIERTA');
  assert.equal(insercion.parametros?.[7], 'PENDIENTE');
});

test('REL-03: lock de incidencia usa SELECT ... FOR UPDATE dentro de la transacción', async () => {
  const cliente = new ClienteFalso();
  cliente.filas = [incidenciaCreada];
  await createIncidentRepository().lock('inc-1', txDe(cliente));
  const consulta = cliente.llamadas.find((llamada) => llamada.sql.includes('FOR UPDATE'))!;
  assert.equal(consulta.parametros?.[0], 'inc-1');
});

test('REL-03: versión confirmada del expediente se deriva de eventos completados', async () => {
  const cliente = new ClienteFalso();
  cliente.filasPor = (sql) => sql.includes('eventos_sincronizacion') ? [
    { payload: JSON.stringify({ payloadVersion: 1, payload: { incidentId: 'inc-1', version: 1 } }) },
    { payload: JSON.stringify({ payloadVersion: 1, payload: { incidentId: 'inc-1', expectedVersion: 1, nextVersion: 2 } }) },
  ] : [];
  assert.equal(await createIncidentRepository().confirmedDossierVersion('inc-1', txDe(cliente)), 2);

  const sinEventos = new ClienteFalso();
  assert.equal(await createIncidentRepository().confirmedDossierVersion('inc-1', txDe(sinEventos)), null);
});

test('REL-03: cerrar incidencia exige estado EN_ANALISIS en el WHERE', async () => {
  const cliente = new ClienteFalso();
  cliente.filas = [{ ...incidenciaCreada, estado: 'CERRADA', resolucion: 'Evaluación documentada' }];
  const cerrada = await createIncidentRepository().close('inc-1', 'Evaluación documentada', 'analista-1', txDe(cliente));
  assert.equal(cerrada.status, 'CERRADA');
  const actualizacion = cliente.llamadas.find((llamada) => llamada.sql.startsWith('UPDATE incidencias'))!;
  assert.equal(actualizacion.sql.includes("estado = 'EN_ANALISIS'"), true);
  assert.equal(actualizacion.parametros?.includes('Evaluación documentada'), true);
});

test('REL-03: bloquear lotes inserta en la misma transacción', async () => {
  const cliente = new ClienteFalso();
  cliente.filas = [{ id: 'bloqueo-1', lote_id: 'lote-1', incidencia_id: 'inc-1', activo: true }];
  const bloqueos = await createBlockRepository().createMany(
    'inc-1', ['lote-1'], 'Dependencia potencial', 'analista-1', txDe(cliente),
  );
  assert.equal(bloqueos.length, 1);
  const insercion = cliente.llamadas.find((llamada) => llamada.sql.includes('INSERT INTO bloqueos_lotes'))!;
  assert.equal(insercion.parametros?.[2], 'Dependencia potencial');
});

test('REL-03: liberar bloqueo ya inactivo falla con BLOCK_ALREADY_RELEASED', async () => {
  const cliente = new ClienteFalso();
  cliente.forzarRowCount = 0;
  await assert.rejects(
    () => createBlockRepository().release('bloqueo-1', 'Revisión', 'analista-1', txDe(cliente)),
    (error: unknown) => error instanceof Error && error.message.includes('BLOCK_ALREADY_RELEASED'),
  );
});

test('REL-04: JWT firma y verifica claims oficiales', () => {
  const ahora = Math.floor(Date.parse('2026-11-25T20:00:00Z') / 1000);
  const token = signJwt({ sub: 'user-1', role: 'ANALISTA_CALIDAD' }, 's'.repeat(32), ahora, 28800);
  const claims = verifyJwt(token, 's'.repeat(32), ahora + 60);
  assert.equal(claims.sub, 'user-1');
  assert.equal(claims.role, 'ANALISTA_CALIDAD');
  assert.equal(claims.iss, 'tracechain');
  assert.equal(claims.aud, 'tracechain-web');
  assert.equal(claims.exp - claims.iat, 28800);
});

test('REL-04: token expirado y firma alterada se rechazan con códigos distintos', () => {
  const ahora = Math.floor(Date.parse('2026-11-25T20:00:00Z') / 1000);
  const token = signJwt({ sub: 'user-1', role: 'OPERADOR' }, 's'.repeat(32), ahora, 60);
  assert.throws(
    () => verifyJwt(token, 's'.repeat(32), ahora + 61),
    (error: unknown) => error instanceof AuthError && error.code === 'TOKEN_EXPIRED',
  );
  const alterado = `${token.slice(0, -2)}xx`;
  assert.throws(
    () => verifyJwt(alterado, 's'.repeat(32), ahora),
    (error: unknown) => error instanceof AuthError && error.code === 'UNAUTHORIZED',
  );
});

test('REL-04: requireRole aplica RBAC en backend', () => {
  const analista = { sub: 'u', role: 'ANALISTA_CALIDAD' as const, iat: 0, exp: 1, iss: 'tracechain' as const, aud: 'tracechain-web' as const };
  assert.doesNotThrow(() => requireRole(analista, ['ANALISTA_CALIDAD']));
  assert.throws(
    () => requireRole({ ...analista, role: 'OPERADOR' }, ['ANALISTA_CALIDAD']),
    (error: unknown) => error instanceof AuthError && error.code === 'FORBIDDEN',
  );
});

test('REL-04: límite de 5 intentos de login por IP en 60 s', () => {
  const limiter = createLoginLimiter(5, 60_000);
  for (let i = 0; i < 5; i += 1) limiter.register('203.0.113.1', 1000 + i);
  assert.throws(
    () => limiter.register('203.0.113.1', 1005),
    (error: unknown) => error instanceof AuthError && error.code === 'RATE_LIMITED',
  );
  assert.doesNotThrow(() => limiter.register('203.0.113.1', 61_000));
  assert.doesNotThrow(() => limiter.register('203.0.113.2', 1001));
});
