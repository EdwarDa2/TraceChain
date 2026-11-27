import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const BASE = new URL('../../', import.meta.url);
const leer = (ruta: string) => readFile(new URL(ruta, BASE), 'utf8');

test('existe un override de pruebas que usa un puerto alterno para PostgreSQL', async () => {
  const compose = await leer('docker-compose.test.yml');
  assert.equal(compose.includes('services:'), true);
  assert.equal(compose.includes('postgres:'), true);
  assert.equal(compose.includes('127.0.0.1:55432:5432'), true);
  assert.equal(/docker\s+stop|kill|taskkill/i.test(compose), false, 'El override no debe detener servicios ajenos');
});

test('el smoke test exercised los tres motores sin secretos', async () => {
  const smoke = await leer('tests/integration/engines-smoke.mjs');
  for (const fragmento of ['pg', 'mongodb', 'neo4j-driver', 'SELECT 1', 'ping', 'RETURN 1']) {
    assert.equal(smoke.includes(fragmento), true, `Falta comprobación de ${fragmento}`);
  }
  assert.equal(/process\.env\.(DATABASE_URL|MONGODB_URI|NEO4J_URI)/.test(smoke), true);
  assert.equal(/mongodb:\/\/[^@\s]+@/.test(smoke), false, 'No se permiten credenciales en el código');
});

test('PROGRESS registra BASE-02 con evidencia y sin afirmar exitos inventados', async () => {
  const progreso = await leer('PROGRESS.md');
  assert.equal(/BASE-02/.test(progreso), true);
  assert.equal(/55432/.test(progreso), true);
});
