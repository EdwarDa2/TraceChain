import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const BASE = new URL('../../', import.meta.url);
const MIGRACIONES = [
  '001_catalogs.sql', '002_inventory.sql', '003_production.sql', '004_distribution.sql',
  '005_incidents.sql', '006_integration.sql', '007_views_indexes.sql',
];

async function sqlCompleto(): Promise<string> {
  const partes = await Promise.all(
    MIGRACIONES.map((nombre) => readFile(new URL(`database/relational/schema/${nombre}`, BASE), 'utf8')),
  );
  return partes.join('\n');
}

test('existen las siete migraciones numeradas y el ejecutor', async () => {
  for (const nombre of MIGRACIONES) {
    const texto = await readFile(new URL(`database/relational/schema/${nombre}`, BASE), 'utf8');
    assert.equal(texto.length > 0, true, `${nombre} está vacía`);
  }
  const ejecutor = await readFile(new URL('database/relational/migrate.mjs', BASE), 'utf8');
  assert.equal(ejecutor.includes('schema_migrations'), true);
  assert.equal(ejecutor.includes('createHash'), true);
});

test('el esquema crea 16 tablas de negocio más schema_migrations', async () => {
  const sql = await sqlCompleto();
  const tablas = [
    'usuarios', 'proveedores', 'productos', 'ubicaciones', 'lotes', 'existencias', 'movimientos',
    'ordenes_produccion', 'consumos_produccion', 'resultados_produccion', 'distribuciones',
    'detalle_distribuciones', 'incidencias', 'bloqueos_lotes', 'eventos_sincronizacion',
    'solicitudes_idempotentes', 'schema_migrations',
  ];
  for (const tabla of tablas) {
    assert.equal(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)?\\s+${tabla}\\s*\\(`, 'i').test(sql), true, `Falta CREATE TABLE ${tabla}`);
  }
  assert.equal((sql.match(/CREATE TABLE/gi) ?? []).length >= 17, true);
});

test('schema_migrations usa version/checksum/applied_at', async () => {
  const sql = await sqlCompleto();
  const bloque = sql.slice(sql.toLowerCase().indexOf('create table schema_migrations'));
  for (const campo of ['version TEXT PRIMARY KEY', 'checksum TEXT NOT NULL', 'applied_at TIMESTAMPTZ NOT NULL']) {
    assert.equal(bloque.includes(campo), true, `schema_migrations: falta ${campo}`);
  }
});

test('convenciones de DATA_MODEL: UUID, NUMERIC(18,3) y FK restrictivas', async () => {
  const sql = await sqlCompleto();
  assert.equal(sql.includes('gen_random_uuid()'), true);
  assert.equal(sql.includes('NUMERIC(18,3)'), true);
  assert.equal(sql.includes('ON DELETE RESTRICT'), true);
  assert.equal(/ON DELETE CASCADE/i.test(sql), false, 'No se permite borrado en cascada');
  assert.equal(/cantidad\s+NUMERIC\(18,3\)\s+NOT NULL\s+CHECK\s*\(cantidad\s*>=\s*0\)/i.test(sql), true, 'Falta CHECK de stock no negativo');
});

test('bloqueos e idempotencia tienen sus unicidades parciales', async () => {
  const sql = await sqlCompleto();
  assert.equal(/CREATE UNIQUE INDEX\s+\w+\s+ON\s+bloqueos_lotes[\s\S]*?WHERE\s+activo/i.test(sql), true);
  assert.equal(/UNIQUE\s*\(usuario_id,\s*operacion,\s*clave\)/i.test(sql), true);
});

test('outbox tiene secuencia serial, payload y estados', async () => {
  const sql = await sqlCompleto();
  assert.equal(/secuencia BIGINT GENERATED (ALWAYS|BY DEFAULT) AS IDENTITY/i.test(sql), true);
  assert.equal(/payload JSONB/i.test(sql), true);
  assert.equal(/motor_destino VARCHAR\(15\)/.test(sql), true);
});

test('existen las tres vistas y sus índices asociados', async () => {
  const sql = await sqlCompleto();
  for (const vista of ['v_inventario', 'v_estado_lotes', 'v_dependencias_productivas']) {
    assert.equal(new RegExp(`CREATE(?: OR REPLACE)? VIEW\\s+${vista}`, 'i').test(sql), true, `Falta vista ${vista}`);
  }
  assert.equal(/CREATE INDEX/i.test(sql), true);
});
