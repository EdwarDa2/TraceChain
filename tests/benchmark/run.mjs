import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import process from 'node:process';
import { URL } from 'node:url';
import pg from 'pg';
import neo4j from 'neo4j-driver';
import { loadCase, unloadGraph } from './lib/generator.mjs';
import { runSql, runCypher, fingerprint, SQL_QUERIES } from './lib/queries.mjs';

const CASES = { 100: 3, 1000: 8, 10000: 15 };
const QUERIES = Object.keys(SQL_QUERIES);
const RESULTS = new URL('./results/', import.meta.url);
const SCHEMA_FILES = ['001_node_constraints.cypher', '002_relationship_constraints.cypher',
  '003_indexes.cypher'];
const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--'))
  .map((arg) => {
    const [key, value] = arg.slice(2).split('=');
    return [key, value];
  }));

function stats(values) {
  const ok = values.filter((value) => Number.isFinite(value));
  if (ok.length === 0) return { mean: null, median: null, p95: null, stddev: null };
  const sorted = [...ok].sort((a, b) => a - b);
  const mean = ok.reduce((sum, value) => sum + value, 0) / ok.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
  const variance = ok.reduce((sum, value) => sum + (value - mean) ** 2, 0) / ok.length;
  return { mean, median, p95, stddev: Math.sqrt(variance) };
}

test('benchmark SQL/Cypher real con semilla fija y resultados equivalentes', async (t) => {
  const caseKey = String(process.env.BENCH_CASE ?? args.case ?? '100');
  if (!Object.hasOwn(CASES, caseKey)) throw new Error('VALIDATION_ERROR: caso no soportado');
  for (const name of ['DATABASE_URL', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    assert.ok(process.env[name], `falta ${name}`);
  }
  const profile = process.env.BENCH_PROFILE ?? 'base';
  const topology = process.env.BENCH_TOPOLOGY ?? 'balanced';
  const depth = Number(process.env.BENCH_DEPTH ?? args.depth ?? CASES[caseKey]);
  if (profile === 'base' && depth !== CASES[caseKey]) {
    throw new Error('VALIDATION_ERROR: profundidad del caso base');
  }
  if (!Number.isInteger(depth) || depth < 1 || depth > 20) throw new Error('VALIDATION_ERROR');
  const repetitions = Number(process.env.BENCH_REPS ?? args.reps ?? 30);
  const warmups = Number(process.env.BENCH_WARMUPS ?? args.warmups ?? 5);
  if (!Number.isInteger(repetitions) || repetitions < 1 ||
      !Number.isInteger(warmups) || warmups < 0) throw new Error('VALIDATION_ERROR');
  await mkdir(RESULTS, { recursive: true });

  const suffix = profile === 'base' ? '' : `-${profile}-${topology}-d${depth}`;
  const caseLabel = `${caseKey}${suffix}`;
  const schema = `benchmark_${caseLabel}_${randomUUID().replaceAll('-', '')}`
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
    options: `-c search_path=${schema} -c statement_timeout=10000`, max: 10 });
  const graph = neo4j.driver(process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
  const database = process.env.NEO4J_DATABASE ?? 'neo4j';
  let manifest;
  try {
    for (const file of SCHEMA_FILES) {
      const cypher = new URL(`../../database/graph/schema/${file}`, import.meta.url);
      const { readFile } = await import('node:fs/promises');
      const statements = (await readFile(cypher, 'utf8')).split(';').map((s) => s.trim()).filter(Boolean);
      for (const statement of statements) await graph.executeQuery(statement, {}, { database });
    }
    const loaded = await loadCase({ pool, driver: graph, database,
      lots: Number(caseKey), depth, label: caseLabel, topology });
    manifest = loaded.manifest;
    await writeFile(new URL(`${caseLabel}-manifest.json`, RESULTS),
      JSON.stringify(manifest, null, 2));
    t.diagnostic(`Caso ${caseLabel}: ${JSON.stringify(manifest.stats)}`);

    const versions = {
      node: process.version,
      postgres: (await pool.query('SELECT version() AS v')).rows[0].v,
      neo4j: (await graph.executeQuery('CALL dbms.components() YIELD versions RETURN versions',
        {}, { database })).records[0].get('versions')[0],
      os: `${os.platform()} ${os.arch()}`,
      cpus: os.cpus().length,
      totalMemoryGb: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
    };
    const baseline = {};
    for (const query of QUERIES) {
      const sqlRows = await runSql(pool, query, depth, manifest);
      const cypherRows = await runCypher(graph, database, query, depth, manifest);
      baseline[query] = {
        sql: fingerprint(sqlRows, query, 'SQL'),
        cypher: fingerprint(cypherRows, query, 'CYPHER'),
        rows: sqlRows.length,
      };
      if (baseline[query].sql !== baseline[query].cypher) {
        t.diagnostic(`SQL ${query}: ${JSON.stringify(sqlRows.slice(0, 5))}`);
        t.diagnostic(`CYPHER ${query}: ${JSON.stringify(cypherRows.slice(0, 5))}`);
      }
      assert.equal(baseline[query].sql, baseline[query].cypher,
        `Equivalencia fallida en ${query} (${caseLabel})`);
    }

    const measurements = [];
    const runOne = async (query, motor) => {
      const started = performance.now();
      let status = 'OK';
      let rows = 0;
      let hash = '';
      try {
        const result = motor === 'SQL'
          ? await runSql(pool, query, depth, manifest)
          : await runCypher(graph, database, query, depth, manifest);
        rows = result.length;
        hash = fingerprint(result, query, motor);
        if (hash !== baseline[query][motor.toLowerCase()]) status = 'MISMATCH';
      } catch (error) {
        status = `ERROR:${String(error.message ?? error).slice(0, 120)}`;
      }
      return { case: caseLabel, query, motor, repetition: null,
        durationMs: performance.now() - started, status, rows, hash };
    };
    for (const query of QUERIES) {
      for (let i = 0; i < warmups; i += 1) {
        await runOne(query, 'SQL');
        await runOne(query, 'CYPHER');
      }
    }
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      for (const [index, query] of QUERIES.entries()) {
        const sqlFirst = (repetition + index) % 2 === 1;
        const motors = sqlFirst ? ['SQL', 'CYPHER'] : ['CYPHER', 'SQL'];
        for (const motor of motors) {
          const row = await runOne(query, motor);
          row.repetition = repetition;
          measurements.push(row);
        }
      }
    }
    const csv = ['case,query,motor,repetition,duration_ms,status,result_count,hash',
      ...measurements.map((row) => [row.case, row.query, row.motor, row.repetition,
        row.durationMs.toFixed(3), row.status, row.rows, row.hash].join(','))].join('\n');
    await writeFile(new URL(`${caseLabel}-raw.csv`, RESULTS), csv);

    const summary = { case: caseLabel, lots: Number(caseKey), depth, seed: 42,
      profile, topology, repetitions, warmups,
      topologyStats: manifest.stats, versions, baseline,
      measurements: {} };
    for (const query of QUERIES) {
      summary.measurements[query] = {};
      for (const motor of ['SQL', 'CYPHER']) {
        const values = measurements.filter((row) => row.query === query && row.motor === motor);
        summary.measurements[query][motor] = {
          ...stats(values.map((row) => row.durationMs)),
          errorRate: values.filter((row) => row.status !== 'OK').length / values.length,
          resultCount: values[0]?.rows ?? null,
        };
      }
    }
    await writeFile(new URL(`${caseLabel}-summary.json`, RESULTS),
      JSON.stringify(summary, null, 2));
    t.diagnostic(`MEDIDAS=${JSON.stringify({ case: caseLabel, depth, repetitions,
      warmups, measurements: measurements.length,
      errors: measurements.filter((row) => row.status !== 'OK').length })}`);
  } finally {
    if (manifest) await unloadGraph(graph, database, manifest.ids);
    await graph.close();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
