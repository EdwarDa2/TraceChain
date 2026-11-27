import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateEnv } from '../../backend/src/config/env.validation.mts';

const BASE = new URL('../../', import.meta.url);
const leer = (ruta: string) => readFile(new URL(ruta, BASE), 'utf8');
const json = async (ruta: string) => JSON.parse(await leer(ruta));

const envValida: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  FRONTEND_URL: 'http://localhost:3000',
  NEXT_PUBLIC_API_URL: 'http://localhost:3001/api/v1',
  DATABASE_URL: 'postgresql://tracechain:tracechain@localhost:5432/tracechain',
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_DATABASE: 'tracechain_quality_test',
  NEO4J_URI: 'bolt://localhost:7687',
  NEO4J_USER: 'neo4j',
  NEO4J_PASSWORD: 'clave-de-prueba',
  NEO4J_DATABASE: 'neo4j',
  JWT_SECRET: 'secreto-de-prueba-con-32-caracteres-abc',
  JWT_EXPIRES_IN: '8h',
  BUSINESS_TIMEZONE: 'America/Mexico_City',
  OUTBOX_ENABLED: 'true',
  OUTBOX_POLL_INTERVAL_MS: '2000',
  OUTBOX_MAX_RETRY_DELAY_MS: '300000',
  GRAPH_DEFAULT_DEPTH: '10',
  GRAPH_MAX_DEPTH: '20',
  GRAPH_MAX_RESULTS: '10000',
  GRAPH_TIMEOUT_MS: '10000',
  SWAGGER_ENABLED: 'false',
};

test('validateEnv acepta configuración completa y tipa los valores', () => {
  const configuracion = validateEnv(envValida);
  assert.equal(configuracion.PORT, 3001);
  assert.equal(configuracion.OUTBOX_ENABLED, true);
  assert.equal(configuracion.SWAGGER_ENABLED, false);
  assert.equal(configuracion.GRAPH_MAX_RESULTS, 10000);
  assert.equal(configuracion.MONGODB_DATABASE, 'tracechain_quality_test');
});

test('validateEnv aplica los valores por defecto del contrato', () => {
  const minimo = { ...envValida };
  for (const clave of ['MONGODB_DATABASE', 'NEO4J_DATABASE', 'JWT_EXPIRES_IN', 'OUTBOX_ENABLED',
    'OUTBOX_POLL_INTERVAL_MS', 'OUTBOX_MAX_RETRY_DELAY_MS', 'GRAPH_DEFAULT_DEPTH',
    'GRAPH_MAX_DEPTH', 'GRAPH_MAX_RESULTS', 'GRAPH_TIMEOUT_MS', 'SWAGGER_ENABLED', 'BUSINESS_TIMEZONE']) {
    delete minimo[clave];
  }
  const configuracion = validateEnv(minimo);
  assert.equal(configuracion.MONGODB_DATABASE, 'tracechain_quality');
  assert.equal(configuracion.NEO4J_DATABASE, 'neo4j');
  assert.equal(configuracion.JWT_EXPIRES_IN, '8h');
  assert.equal(configuracion.OUTBOX_ENABLED, true);
  assert.equal(configuracion.OUTBOX_POLL_INTERVAL_MS, 2000);
  assert.equal(configuracion.OUTBOX_MAX_RETRY_DELAY_MS, 300000);
  assert.equal(configuracion.GRAPH_DEFAULT_DEPTH, 10);
  assert.equal(configuracion.GRAPH_MAX_DEPTH, 20);
  assert.equal(configuracion.GRAPH_MAX_RESULTS, 10000);
  assert.equal(configuracion.GRAPH_TIMEOUT_MS, 10000);
  assert.equal(configuracion.SWAGGER_ENABLED, false);
  assert.equal(configuracion.BUSINESS_TIMEZONE, 'America/Mexico_City');
});

test('validateEnv reporta variables ausentes sin exponer valores', () => {
  const incompleto = { ...envValida };
  delete incompleto.JWT_SECRET;
  delete incompleto.DATABASE_URL;
  assert.throws(
    () => validateEnv(incompleto),
    (error: unknown) => {
      const mensaje = error instanceof Error ? error.message : '';
      return mensaje.includes('JWT_SECRET') && mensaje.includes('DATABASE_URL') &&
        !mensaje.includes('secreto-de-prueba');
    },
  );
});

test('validateEnv rechaza valores inválidos sin incluirlos en el error', () => {
  const casos: [string, string][] = [
    ['PORT', '70000'],
    ['FRONTEND_URL', 'no-es-url'],
    ['JWT_SECRET', 'corto'],
    ['OUTBOX_ENABLED', 'quizas'],
    ['GRAPH_DEFAULT_DEPTH', '0'],
    ['GRAPH_MAX_RESULTS', '-1'],
    ['BUSINESS_TIMEZONE', 'UTC'],
  ];
  for (const [clave, valor] of casos) {
    const patron = new RegExp(`(^|[^0-9A-Za-z])${valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^0-9A-Za-z]|$)`);
    assert.throws(
      () => validateEnv({ ...envValida, [clave]: valor }),
      (error: unknown) => {
        const mensaje = error instanceof Error ? error.message : "";
        return !patron.test(mensaje);
      },
      `El error de ${clave} no debe exponer el valor inválido`,
    );
  }
});

test('manifiesto raíz declara workspaces y scripts canónicos', async () => {
  const paquete = await json('package.json');
  assert.deepEqual(paquete.workspaces, ['backend', 'frontend', 'packages/contracts']);
  for (const script of ['dev', 'dev:backend', 'dev:frontend', 'db:up', 'db:migrate', 'db:seed',
    'lint', 'typecheck', 'test', 'test:integration', 'test:e2e', 'benchmark', 'build']) {
    assert.equal(typeof paquete.scripts?.[script], 'string', `Falta script ${script}`);
  }
});

test('backend y frontend declaran el stack aprobado', async () => {
  const backend = await json('backend/package.json');
  const frontend = await json('frontend/package.json');
  for (const dependencia of ['@nestjs/core', '@nestjs/config', 'pg', 'mongodb', 'neo4j-driver', 'argon2', 'class-validator']) {
    assert.ok(backend.dependencies?.[dependencia], `backend falta ${dependencia}`);
  }
  for (const dependencia of ['next', 'react', 'react-dom', 'tailwindcss']) {
    assert.ok(frontend.dependencies?.[dependencia] ?? frontend.devDependencies?.[dependencia], `frontend falta ${dependencia}`);
  }
  assert.ok(backend.devDependencies?.typescript, 'backend falta typescript');
  assert.ok(!backend.dependencies?.prisma && !backend.dependencies?.typeorm, 'No se permite ORM');
});

test('docker-compose declara cinco servicios, volúmenes y puertos en loopback', async () => {
  const compose = await leer('docker-compose.yml');
  for (const servicio of ['frontend:', 'backend:', 'postgres:', 'mongodb:', 'neo4j:']) {
    assert.equal(compose.includes(servicio), true, `Falta servicio ${servicio}`);
  }
  for (const volumen of ['postgres_data:', 'mongodb_data:', 'neo4j_data:']) {
    assert.equal(compose.includes(volumen), true, `Falta volumen ${volumen}`);
  }
  for (const puerto of ['3000:3000', '3001:3001', '5432', '27017', '7687', '7474']) {
    assert.equal(compose.includes(puerto), true, `Falta puerto ${puerto}`);
  }
  for (const loopback of ['127.0.0.1:5432', '127.0.0.1:27017', '127.0.0.1:7687']) {
    assert.equal(compose.includes(loopback), true, `DB sin loopback: ${loopback}`);
  }
});

test('.env.example contiene las variables requeridas sin secretos reales', async () => {
  const ejemplo = await leer('.env.example');
  for (const clave of Object.keys(envValida)) {
    assert.equal(new RegExp(`^${clave}=`, 'm').test(ejemplo), true, `Falta ${clave} en .env.example`);
  }
  assert.equal(/JWT_SECRET=.{32,}/.test(ejemplo), false, 'No se permite un JWT_SECRET real');
  assert.equal(/mongodb:\/\/[^@\s]+@/.test(ejemplo), false, 'URI con credenciales en .env.example');
});

test('CI ejecuta las verificaciones obligatorias', async () => {
  const ci = await leer('.github/workflows/ci.yml');
  for (const comando of ['npm ci', 'npm run lint', 'npm run typecheck', 'npm run test', 'npm run build', 'npm run test:integration']) {
    assert.equal(ci.includes(comando), true, `CI no ejecuta ${comando}`);
  }
});
