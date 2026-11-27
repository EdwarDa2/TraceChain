import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { dispatchNext } from '../../backend/src/integration/outbox/dispatcher.mts';
import { createOutboxWriter } from '../../backend/src/database/postgres/transaction.mts';

test('RN-120: exclusión, orden, reintento y recuperación tras fallo del ACK', async () => {
  assert.ok(process.env.DATABASE_URL);
  const schema = `outbox_test_${randomUUID().replaceAll('-', '')}`;
  const control = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await control.connect();
  await control.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  try {
    const migration = await readFile(new URL('../../database/relational/schema/006_integration.sql', import.meta.url), 'utf8');
    // Dependencia de la segunda tabla de la migración; sin datos de usuarios.
    await pool.query('CREATE TABLE usuarios (id uuid PRIMARY KEY)');
    await pool.query(migration);
    const ids = [randomUUID(), randomUUID()];
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      for (const id of ids) await createOutboxWriter().enqueue({
        eventId: id, entityId: id, entityType: 'SUPPLIER', eventType: 'PROVEEDOR_CREADO',
        destination: 'NEO4J', payload: { supplier: { id, code: 'P-1', name: 'Proveedor ficticio', active: true } },
      }, tx);
      await tx.query('COMMIT');
    } finally { tx.release(); }
    const unexpected = async () => { throw new Error('entrega inesperada'); };
    assert.equal(await dispatchNext(pool, 'NEO4J', async (event) => {
      assert.equal(event.eventId, ids[0]);
      assert.equal(await dispatchNext(pool, 'NEO4J', unexpected), 'idle');
      throw new Error('error privado de prueba');
    }), 'failed');
    const failed = (await pool.query(`SELECT ultimo_error, intentos,
      proximo_intento_at > now() AS futuro FROM eventos_sincronizacion WHERE id=$1`, [ids[0]])).rows[0];
    assert.deepEqual(failed, { ultimo_error: 'TRANSITORIO', intentos: 1, futuro: true });
    assert.equal(await dispatchNext(pool, 'NEO4J', unexpected), 'idle');
    await pool.query("UPDATE eventos_sincronizacion SET proximo_intento_at=now() WHERE estado='FALLIDO'");

    // Forzar caída exclusivamente en el ACK, después de finalizar el callback.
    await pool.query("ALTER TABLE eventos_sincronizacion ADD CONSTRAINT simular_caida CHECK (estado <> 'COMPLETADO')");
    const applied: string[] = [];
    const apply = async (event: { eventId: string }) => { applied.push(event.eventId); };
    await assert.rejects(dispatchNext(pool, 'NEO4J', apply), { code: '23514' });
    await pool.query('ALTER TABLE eventos_sincronizacion DROP CONSTRAINT simular_caida');
    assert.equal(await dispatchNext(pool, 'NEO4J', apply), 'applied');
    assert.equal(await dispatchNext(pool, 'NEO4J', apply), 'applied');
    assert.deepEqual(applied, [ids[0], ...ids]);
    assert.equal(await dispatchNext(pool, 'NEO4J', unexpected), 'idle');
    await pool.query(`UPDATE eventos_sincronizacion SET estado='PENDIENTE',
      payload='{"payloadVersion":2,"payload":{}}' WHERE id=$1`, [ids[0]]);
    assert.equal(await dispatchNext(pool, 'NEO4J', apply), 'failed');
    assert.equal(await dispatchNext(pool, 'NEO4J', apply), 'idle');
    assert.equal(applied.length, 3);

    // La cabeza permanente de Neo4j no bloquea la cola documental.
    const incident = randomUUID();
    await pool.query('CREATE TABLE incidencias (id uuid PRIMARY KEY, estado_expediente text NOT NULL)');
    await pool.query("INSERT INTO incidencias VALUES ($1, 'PENDIENTE')", [incident]);
    await pool.query(`INSERT INTO eventos_sincronizacion
      (tipo_evento, entidad_id, tipo_entidad, motor_destino, payload)
      VALUES ('INCIDENCIA_REGISTRADA',$1,'INCIDENT','MONGODB',$2),
             ('EXPEDIENTE_ACTUALIZADO',$1,'INCIDENT','MONGODB',$2)`,
    [incident, { payloadVersion: 1, payload: { incidentId: incident } }]);
    for (const expected of ['PENDIENTE', 'SINCRONIZADO']) {
      assert.equal(await dispatchNext(pool, 'MONGODB', apply), 'applied');
      assert.equal((await pool.query('SELECT estado_expediente FROM incidencias WHERE id=$1', [incident])).rows[0].estado_expediente, expected);
    }
  } finally {
    await pool.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  }
});
