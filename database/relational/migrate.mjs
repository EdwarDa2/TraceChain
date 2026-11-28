// Ejecutor de migraciones SQL versionadas de I-1.
// Uso: DATABASE_URL=... node database/relational/migrate.mjs
// No editar migraciones aplicadas: cambiar el checksum bloquea la ejecución (AI-09).

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const { Pool } = pg;

const MIGRACIONES = new URL('./schema/', import.meta.url);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL es obligatorio');
  process.exit(1);
}

const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10_000 });
const archivos = (await readdir(MIGRACIONES)).filter((nombre) => /^\d+_.*\.sql$/.test(nombre)).sort();

try {
  // 001_catalogs.sql crea schema_migrations; no duplicar esa DDL aquí (AI-09).
  const tabla = await pool.query("SELECT to_regclass('schema_migrations') IS NOT NULL AS ok");
  let registroDisponible = Boolean(tabla.rows[0]?.ok);

  // Entornos de desarrollo anteriores pueden tener el esquema aplicado y la tabla
  // de registro vacía: registrar los checksums sin volver a ejecutar la DDL.
  if (registroDisponible) {
    const total = await pool.query('SELECT count(*)::int AS n FROM schema_migrations');
    const esquema = await pool.query("SELECT to_regclass('usuarios') IS NOT NULL AS ok");
    if (total.rows[0]?.n === 0 && esquema.rows[0]?.ok) {
      for (const archivo of archivos) {
        const sql = await readFile(new URL(archivo, MIGRACIONES), 'utf8');
        const version = archivo.replace(/\.sql$/, '');
        await pool.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [version, createHash('sha256').update(sql).digest('hex')]);
        console.log(`Registrada: ${version}`);
      }
      await pool.end();
      process.exit(0);
    }
  }

  for (const archivo of archivos) {
    const sql = await readFile(new URL(archivo, MIGRACIONES), 'utf8');
    const version = archivo.replace(/\.sql$/, '');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const aplicada = registroDisponible
      ? await pool.query('SELECT checksum FROM schema_migrations WHERE version = $1', [version])
      : { rowCount: 0, rows: [] };

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
      const yaCreada = version.startsWith('001_')
        ? await cliente.query("SELECT to_regclass('usuarios') IS NOT NULL AS ok")
        : { rows: [{ ok: false }] };
      if (!yaCreada.rows[0]?.ok) await cliente.query(sql);
      await cliente.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
        [version, checksum],
      );
      await cliente.query('COMMIT');
      registroDisponible = true;
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
