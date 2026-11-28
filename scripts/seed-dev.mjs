/** Siembra local de demostración para revisar la UI; datos ficticios sobre la BD aislada de pruebas. */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import neo4j from 'neo4j-driver';
import argon2 from 'argon2';
import { MongoClient } from 'mongodb';
import { loadCase, stableUuid } from '../tests/benchmark/lib/generator.mjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const graph = neo4j.driver(process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
const mongo = new MongoClient(process.env.MONGODB_URI);
const db = mongo.db(process.env.MONGODB_DATABASE ?? 'tracechain_quality');
const database = process.env.NEO4J_DATABASE ?? 'neo4j';
const label = 'dev-seed-1';
const analystId = stableUuid(`${label}:user`, 0);
const operatorId = stableUuid(`${label}:user`, 1);
try {
  const { manifest } = await loadCase({ pool, driver: graph, database,
    lots: 30, depth: 3, label, topology: 'balanced' });
  // El cargador experimental inserta códigos OP-/DIST- directamente. Sin avanzar
  // las secuencias operativas, las altas dinámicas posteriores colisionan.
  for (const [table, column, sequence, prefix] of [
    ['ordenes_produccion', 'codigo', 'codigo_op_seq', 'OP'],
    ['distribuciones', 'codigo', 'codigo_dist_seq', 'DIST'],
  ]) {
    const max = await pool.query(
      `SELECT COALESCE(max(substring(${column} from '[0-9]+$')::bigint), 0) AS n
       FROM ${table} WHERE ${column} LIKE $1`, [`${prefix}-%`]);
    await pool.query(`SELECT setval($1::regclass, GREATEST($2, 1), true)`,
      [sequence, max.rows[0].n]);
  }
  const hash = await argon2.hash('demo-tracechain-2026', { type: argon2.argon2id });
  await pool.query(`UPDATE usuarios SET nombre=$1, correo=$2, password_hash=$3, rol='ANALISTA_CALIDAD'
    WHERE id=$4`, ['Analista demo', 'analista@example.invalid', hash, analystId]);
  await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol)
    VALUES($1,'Operador demo','operador@example.invalid',$2,'OPERADOR')
    ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash`, [operatorId, hash]);
  await mongo.connect();
  const incidentId = randomUUID();
  await pool.query(`INSERT INTO incidencias(id,codigo,lote_origen_id,titulo,tipo,severidad,
    reportado_por,fecha_deteccion,estado,estado_expediente)
    VALUES($1,'INC-DEMO-000001',$2,'Investigación de demostración','CALIDAD','ALTA',$3,
    '2026-11-25T20:00:00Z','EN_ANALISIS','SINCRONIZADO')`,
  [incidentId, manifest.rootIds[0], analystId]);
  await db.collection('expedientes_incidencias').updateOne({ incidencia_id: incidentId },
    { $setOnInsert: { _id: randomUUID(), incidencia_id: incidentId,
      descripcion: 'Expediente ficticio de demostración', inspecciones_ids: [], hallazgos: [],
      evidencias: [], observaciones: null, resolucion_detallada: null, version: 1,
      ultimo_evento_id: randomUUID(), created_at: new Date(), updated_at: new Date() } },
    { upsert: true });
  process.stdout.write(`DEV_SEED=ok lots=${manifest.stats.lots} processes=${manifest.stats.processes}\n`);
} finally {
  await mongo.close();
  await graph.close();
  await pool.end();
}
