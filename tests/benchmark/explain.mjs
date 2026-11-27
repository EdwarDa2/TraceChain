import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import pg from 'pg';
import neo4j from 'neo4j-driver';
import { loadCase, unloadGraph } from './lib/generator.mjs';
import { SQL_QUERIES, CYPHER_QUERIES } from './lib/queries.mjs';

const QUERIES = ['QE01', 'QE02', 'QE03', 'QE04', 'QE05'];
const OUT = new URL('../../docs/pruebas/', import.meta.url);

test('diagnósticos reales: EXPLAIN ANALYZE (SQL) y PROFILE (Cypher) separados de latencia', async (t) => {
  for (const name of ['DATABASE_URL', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    assert.ok(process.env[name], `falta ${name}`);
  }
  await mkdir(OUT, { recursive: true });
  const label = 'explain-1000-d8';
  const schema = `bench_${label}_${randomUUID().replaceAll('-', '')}`
    .replace(/[^A-Za-z0-9_]/g, '_');
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
  } catch (error) {
    await admin.end();
    throw error;
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema} -c statement_timeout=20000`, max: 6 });
  const graph = neo4j.driver(process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
  const database = process.env.NEO4J_DATABASE ?? 'neo4j';
  let manifest;
  try {
    const loaded = await loadCase({ pool, driver: graph, database,
      lots: 1000, depth: 8, label, topology: 'balanced' });
    manifest = loaded.manifest;
    const document = {
      fecha: new Date().toISOString(),
      caso: label,
      proposito: 'Diagnóstico de planes, no medición de latencia; excluido del CSV de 2700 mediciones.',
      entorno: {
        node: process.version,
        postgres: (await pool.query('SELECT version() AS v')).rows[0].v,
        neo4j: (await graph.executeQuery('CALL dbms.components() YIELD versions RETURN versions',
          {}, { database })).records[0].get('versions')[0],
      },
      planes: {},
    };
    for (const query of QUERIES) {
      const sqlQuery = SQL_QUERIES[query].sql(8);
      const sqlParams = SQL_QUERIES[query].params(manifest);
      const explained = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sqlQuery}`,
        sqlParams);
      const rawPlan = explained.rows[0]?.['QUERY PLAN'];
      const sqlPlan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;
      const cypherQuery = CYPHER_QUERIES[query].cypher(8);
      const cypherParams = CYPHER_QUERIES[query].params(manifest);
      const profiled = await graph.executeQuery(`PROFILE ${cypherQuery}`, cypherParams,
        { database, timeout: 20_000 });
      const plan = profiled.summary.plan ?? null;
      document.planes[query] = {
        sql: {
          query: sqlQuery,
          executionTimeMs: sqlPlan?.['Execution Time'] ?? null,
          planningTimeMs: sqlPlan?.['Planning Time'] ?? null,
          plan: sqlPlan?.['Plan'] ?? null,
        },
        cypher: {
          query: cypherQuery,
          resultCount: profiled.records.length,
          plan,
        },
      };
      t.diagnostic(`${query}: SQL EXPLAIN=${document.planes[query].sql.executionTimeMs} ms; ` +
        `Cypher filas=${profiled.records.length}`);
    }
    await writeFile(new URL('benchmark-plans.json', OUT), JSON.stringify(document, null, 2));
  } finally {
    if (manifest) await unloadGraph(graph, database, manifest.ids);
    await graph.close();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
