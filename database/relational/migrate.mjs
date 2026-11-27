// Ejecutor de migraciones SQL versionadas de I-1.
// Uso: DATABASE_URL=... node database/relational/migrate.mjs
// No editar migraciones aplicadas: cambiar el checksum bloquea la ejecución (AI-09).

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const MIGRACIONES = new URL('./schema/', import.meta.url);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL es obligatorio');
  process.exit(1);
}

const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10_000 });
const archivos = (await readdir(MIGRACIONES)).filter((nombre) => /^\d+_.*\.sql$/.test(nombre)).sort();

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  for (const archivo of archivos) {
    const sql = await readFile(new URL(archivo, MIGRACIONES), 'utf8');
    const version = archivo.replace(/\.sql$/, '');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const aplicada = await pool.query('SELECT checksum FROM schema_migrations WHERE version = $1', [version]);

    if (aplicada.rowCount === 1) {
      if (aplicada.rows[0].checksum !== checksum) {
        throw new Error(`La migración ${version} ya está aplicada con otro checksum`);
      }
      console.log(`Omitida: ${version}`);
      continue;
    }

    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(sql);
      await cliente.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
        [version, checksum],
      );
      await cliente.query('COMMIT');
      console.log(`Aplicada: ${version}`);
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }
} finally {
  await pool.end();
}
