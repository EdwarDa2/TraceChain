// Smoke test de infraestructura (BASE-02). Solo verifica conectividad de los tres motores.
// Uso (con dependencias instaladas):
//   DATABASE_URL=<uri-postgresql-puerto-55432> \
//   MONGODB_URI=<uri-mongodb> NEO4J_URI=bolt://localhost:7687 \
//   NEO4J_USER=<usuario> NEO4J_PASSWORD=<clave> \
//   node tests/integration/engines-smoke.mjs
// Los valores vienen del entorno; nunca se escriben credenciales en el código.

import { Client } from 'pg';
import { MongoClient } from 'mongodb';
import neo4j from 'neo4j-driver';

const resultados = [];

async function verificarPostgres() {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  await cliente.connect();
  try {
    const respuesta = await cliente.query('SELECT 1 AS ok');
    if (respuesta.rows[0]?.ok !== 1) throw new Error('PostgreSQL no devolvió 1');
    resultados.push('PostgreSQL: OK');
  } finally {
    await cliente.end();
  }
}

async function verificarMongo() {
  const cliente = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  await cliente.connect();
  try {
    const respuesta = await cliente.db('admin').command({ ping: 1 });
    if (respuesta.ok !== 1) throw new Error('MongoDB no respondió ping');
    resultados.push('MongoDB: OK');
  } finally {
    await cliente.close();
  }
}

async function verificarNeo4j() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  try {
    const sesion = driver.session();
    try {
      const respuesta = await sesion.run('RETURN 1 AS ok');
      const registro = respuesta.records[0];
      if (registro === undefined || Neo4jInteger(registro.get('ok')) !== 1) {
        throw new Error('Neo4j no devolvió 1');
      }
      resultados.push('Neo4j: OK');
    } finally {
      await sesion.close();
    }
  } finally {
    await driver.close();
  }
}

function Neo4jInteger(valor) {
  return typeof valor === 'object' && valor !== null && 'toNumber' in valor ? valor.toNumber() : Number(valor);
}

try {
  await Promise.all([verificarPostgres(), verificarMongo(), verificarNeo4j()]);
  for (const resultado of resultados.sort()) console.log(resultado);
  console.log('BASE-02 smoke: 3/3 motores disponibles');
} catch (error) {
  console.error('BASE-02 smoke FALLÓ:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
