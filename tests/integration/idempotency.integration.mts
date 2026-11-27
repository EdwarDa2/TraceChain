import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createIdempotencyStore } from '../../backend/src/database/postgres/transaction.mts';

test('RN-119: respuesta SQL persiste, rollback no reserva y claves concurrentes serializan', async () => {
  assert.ok(process.env.DATABASE_URL);
  const schema = `idempotency_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  try {
    await pool.query('CREATE TABLE usuarios (id uuid PRIMARY KEY)');
    const migration = await readFile(new URL('../../database/relational/schema/006_integration.sql', import.meta.url), 'utf8');
    await pool.query(migration);
    const actorId = randomUUID();
    await pool.query('INSERT INTO usuarios(id) VALUES ($1)', [actorId]);
    const request = { actorId, operacion: 'POST /lots/receipts', clave: randomUUID(), hash: 'a'.repeat(64) };
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await first.query('BEGIN');
      assert.deepEqual(await createIdempotencyStore().reserve(request, first), { replay: false });
      await createIdempotencyStore().confirm(request, 201, { data: { id: randomUUID() } }, first);
      let secondSettled = false;
      const waiting = createIdempotencyStore().reserve(request, second).then((result) => {
        secondSettled = true;
        return result;
      });
      await new Promise((resolve) => setTimeout(resolve, 60));
      assert.equal(secondSettled, false);
      await first.query('COMMIT');
      const replay = await waiting;
      assert.equal(replay.replay, true);
      if (replay.replay) assert.equal(replay.status, 201);
      await assert.rejects(createIdempotencyStore().reserve({ ...request, hash: 'b'.repeat(64) }, second),
        /IDEMPOTENCY_CONFLICT/);
      const rolledBack = { ...request, clave: randomUUID() };
      await first.query('BEGIN');
      assert.deepEqual(await createIdempotencyStore().reserve(rolledBack, first), { replay: false });
      await createIdempotencyStore().confirm(rolledBack, 201, { data: { id: randomUUID() } }, first);
      await first.query('ROLLBACK');
      assert.deepEqual(await createIdempotencyStore().reserve(rolledBack, second), { replay: false });
      assert.equal((await pool.query('SELECT count(*)::integer AS n FROM solicitudes_idempotentes')).rows[0].n, 1);
    } finally {
      first.release();
      second.release();
    }
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
