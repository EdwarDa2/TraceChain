import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import { setTimeout } from 'node:timers';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import pg from 'pg';
import neo4j from 'neo4j-driver';
import { MongoClient } from 'mongodb';
import { AppModule } from '../../backend/dist/app.module.js';
const { Client } = pg;

test('NestJS arranca consumidor Neo y confirma proyección y ACK SQL', async () => {
  assert.ok(process.env.DATABASE_URL);
  const schema = `outbox_runtime_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const testUrl = new URL(process.env.DATABASE_URL);
  testUrl.searchParams.set('options', `-c search_path=${schema}`);
  const database = new Client({ connectionString: testUrl.toString() });
  const graph = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
  const mongo = new MongoClient(process.env.MONGODB_URI);
  const mongoDatabase = `tracechain_runtime_${randomUUID().replaceAll('-', '')}`;
  const nodeId = randomUUID();
  const incidentId = randomUUID();
  let app;
  try {
    await database.connect();
    await database.query('CREATE TABLE usuarios (id uuid PRIMARY KEY)');
    await database.query('CREATE TABLE incidencias (id uuid PRIMARY KEY, estado_expediente text NOT NULL)');
    const migration = await readFile(new URL('../../database/relational/schema/006_integration.sql', import.meta.url), 'utf8');
    await database.query(migration);
    await mongo.connect();
    const validator = JSON.parse(await readFile(new URL('../../database/document/validators/expedientes-incidencias.schema.json',
      import.meta.url), 'utf8'));
    await mongo.db(mongoDatabase).createCollection('expedientes_incidencias', {
      validator, validationAction: 'error', validationLevel: 'strict',
    });
    await mongo.db(mongoDatabase).collection('expedientes_incidencias').createIndex({ incidencia_id: 1 }, { unique: true });
    process.env.DATABASE_URL = testUrl.toString();
    process.env.MONGODB_DATABASE = mongoDatabase;
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.OUTBOX_ENABLED = 'true';
    process.env.OUTBOX_POLL_INTERVAL_MS = '100';
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    await database.query(`INSERT INTO eventos_sincronizacion
      (id, tipo_evento, entidad_id, tipo_entidad, motor_destino, payload)
      VALUES ($1,'PROVEEDOR_CREADO',$2,'SUPPLIER','NEO4J',$3::jsonb)`, [
      randomUUID(), nodeId, JSON.stringify({ payloadVersion: 1, payload: {
        supplier: { id: nodeId, code: 'TEST-RUNTIME', name: 'Proveedor ficticio', active: true },
      } }),
    ]);
    const deadline = Date.now() + 10_000;
    let completed = false;
    while (Date.now() < deadline) {
      const result = await database.query('SELECT estado FROM eventos_sincronizacion WHERE entidad_id=$1', [nodeId]);
      if (result.rows[0]?.estado === 'COMPLETADO') {
        completed = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(completed, 'el worker debe proyectar y confirmar sin una llamada manual al handler');
    const projection = await graph.executeQuery('MATCH (p:Proveedor {id:$id}) RETURN p.codigo AS code',
      { id: nodeId }, { database: process.env.NEO4J_DATABASE ?? 'neo4j' });
    assert.equal(projection.records[0]?.get('code'), 'TEST-RUNTIME');
    await database.query("INSERT INTO incidencias VALUES ($1,'PENDIENTE')", [incidentId]);
    await database.query(`INSERT INTO eventos_sincronizacion
      (id, tipo_evento, entidad_id, tipo_entidad, motor_destino, payload)
      VALUES ($1,'INCIDENCIA_REGISTRADA',$2,'INCIDENT','MONGODB',$3::jsonb)`, [
      randomUUID(), incidentId, JSON.stringify({ payloadVersion: 1, payload: {
        incidentId, dossierId: randomUUID(), version: 1,
        fields: { description: 'Caso ficticio', inspectionIds: [], findings: [], evidence: [],
          notes: null, detailedResolution: null },
      } }),
    ]);
    let synchronized = false;
    const mongoDeadline = Date.now() + 10_000;
    while (Date.now() < mongoDeadline) {
      const result = await database.query('SELECT estado_expediente FROM incidencias WHERE id=$1', [incidentId]);
      if (result.rows[0]?.estado_expediente === 'SINCRONIZADO') {
        synchronized = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(synchronized, 'el segundo consumidor debe confirmar expediente y estado SQL');
    assert.equal(await mongo.db(mongoDatabase).collection('expedientes_incidencias')
      .countDocuments({ incidencia_id: incidentId }), 1);
  } finally {
    if (app) await app.close();
    await mongo.db(mongoDatabase).dropDatabase();
    await mongo.close();
    await graph.executeQuery('MATCH (p:Proveedor {id:$id}) DETACH DELETE p',
      { id: nodeId }, { database: process.env.NEO4J_DATABASE ?? 'neo4j' });
    await graph.close();
    await database.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
