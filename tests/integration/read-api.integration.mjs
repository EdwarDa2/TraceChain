import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import pg from 'pg';
import argon2 from 'argon2';
import supertest from 'supertest';
import { MongoClient } from 'mongodb';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

test('API de lectura real: catálogos, inventario, calidad, incidencias y sistema', async () => {
  for (const name of ['DATABASE_URL', 'MONGODB_URI', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
    assert.ok(process.env[name], `falta ${name}`);
  }
  const schema = `read_api_${randomUUID().replaceAll('-', '')}`;
  const mongoDatabase = `tracechain_read_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const originalUrl = process.env.DATABASE_URL;
  const originalMongo = process.env.MONGODB_DATABASE;
  const originalWorker = process.env.OUTBOX_ENABLED;
  const url = new URL(originalUrl);
  url.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  process.env.MONGODB_DATABASE = mongoDatabase;
  process.env.OUTBOX_ENABLED = 'false';
  process.env.JWT_SECRET = 'clave-ficticia-read-api-para-pruebas-12345';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const mongo = new MongoClient(process.env.MONGODB_URI);
  const db = mongo.db(mongoDatabase);
  const ids = { analyst: randomUUID(), operator: randomUUID(), supplier: randomUUID(), product: randomUUID(),
    location: randomUUID(), lot: randomUUID(), incident: randomUUID() };
  let app;
  try {
    for (const version of ['001_catalogs', '002_inventory', '003_production',
      '004_distribution', '005_incidents', '006_integration', '007_views_indexes', '008_operation_codes']) {
      await pool.query(await readFile(
        new URL(`../../database/relational/schema/${version}.sql`, import.meta.url), 'utf8'));
    }
    const hash = await argon2.hash('prueba-read-api', { type: argon2.argon2id });
    await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol) VALUES
      ($1,'Analista ficticio','qa-read@example.invalid',$3,'ANALISTA_CALIDAD'),
      ($2,'Operador ficticio','op-read@example.invalid',$3,'OPERADOR')`,
    [ids.analyst, ids.operator, hash]);
    await pool.query('INSERT INTO proveedores(id,codigo,nombre) VALUES($1,$2,$3)',
      [ids.supplier, 'PROV-READ', 'Proveedor ficticio']);
    await pool.query(`INSERT INTO productos(id,codigo,nombre,tipo,unidad_medida)
      VALUES($1,$2,$3,'MATERIA_PRIMA','KG')`, [ids.product, 'PRD-READ', 'Materia prima ficticia']);
    await pool.query(`INSERT INTO ubicaciones(id,codigo,nombre,tipo)
      VALUES($1,$2,$3,'PLANTA_PRODUCCION')`, [ids.location, 'UB-READ', 'Planta ficticia']);
    await pool.query(`INSERT INTO lotes(id,codigo,producto_id,proveedor_id,tipo_origen,
      cantidad_inicial,fecha_origen,registrado_por) VALUES($1,$2,$3,$4,'RECEPCION','10.000',
      '2026-11-25T20:00:00Z',$5)`, [ids.lot, 'MP-READ', ids.product, ids.supplier, ids.analyst]);
    await pool.query(`INSERT INTO existencias(id,lote_id,ubicacion_id,cantidad)
      VALUES($1,$2,$3,'10.000')`, [randomUUID(), ids.lot, ids.location]);
    await pool.query(`INSERT INTO incidencias(id,codigo,lote_origen_id,titulo,tipo,severidad,
      reportado_por,fecha_deteccion) VALUES($1,$2,$3,$4,'CALIDAD','MEDIA',$5,'2026-11-25T20:01:00Z')`,
    [ids.incident, 'INC-READ', ids.lot, 'Investigación ficticia', ids.analyst]);
    await mongo.connect();
    await db.collection('plantillas_inspeccion').insertOne({ _id: randomUUID(), codigo: 'TPL-READ',
      nombre: 'Plantilla ficticia', producto_id: null, version: 1, activo: true,
      created_at: new Date(), parametros: [] });
    await db.collection('inspecciones_calidad').insertOne({ _id: randomUUID(), codigo: 'INS-READ',
      lote_id: ids.lot, producto_id: ids.product, plantilla_id: randomUUID(), plantilla_version: 1,
      inspector_id: ids.analyst, fecha_inspeccion: new Date('2026-11-25T20:02:00Z'),
      parametros: {}, resultado: 'NO_CONFORME', hallazgos: [{ tipo: 'APARIENCIA',
        parametro: null, descripcion: 'Hallazgo ficticio', severidad: 'MEDIA' }],
      observaciones: null, evidencias: [], idempotency_key: randomUUID(),
      request_hash: 'hash', created_at: new Date() });

    const { AppModule } = await import('../../backend/dist/app.module.js');
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    const http = supertest(app.getHttpServer());
    assert.equal((await http.get('/api/v1/suppliers')).status, 401);
    const token = (await http.post('/api/v1/auth/login')
      .send({ email: 'qa-read@example.invalid', password: 'prueba-read-api' })).body.data.accessToken;
    const get = (path) => http.get(path).set('Authorization', `Bearer ${token}`);
    for (const path of ['/api/v1/suppliers', '/api/v1/products', '/api/v1/locations',
      '/api/v1/lots', '/api/v1/inventory', '/api/v1/inventory/movements',
      '/api/v1/production-orders', '/api/v1/distributions', '/api/v1/inspections',
      '/api/v1/quality/summary', '/api/v1/quality/findings', '/api/v1/incidents',
      '/api/v1/dashboard/summary', '/api/v1/dashboard/recent-activity',
      '/api/v1/system/sync-status', `/api/v1/suppliers/${ids.supplier}`,
      `/api/v1/products/${ids.product}`, `/api/v1/locations/${ids.location}`,
      `/api/v1/lots/${ids.lot}`, `/api/v1/lots/${ids.lot}/details`,
      `/api/v1/incidents/${ids.incident}`, `/api/v1/incidents/${ids.incident}/dossier`,
      `/api/v1/incidents/${ids.incident}/blocks`, `/api/v1/lots/${ids.lot}/blocks`]) {
      const response = await get(path);
      assert.equal(response.status, 200, `${path}: ${JSON.stringify(response.body)}`);
      assert.ok(response.body.data !== undefined, path);
    }
    assert.equal((await get('/api/v1/suppliers?page=0')).status, 400);
    assert.equal((await get('/api/v1/suppliers?sortBy=nope')).status, 400);
    const filteredLots = await get('/api/v1/lots').query({ productId: ids.product });
    assert.equal(filteredLots.status, 200, JSON.stringify(filteredLots.body));
    assert.equal(filteredLots.body.data.length, 1);
    assert.equal((await get('/api/v1/dashboard/summary')).body.data.totalLots, 1);
    assert.equal((await get('/api/v1/quality/summary')).body.data.nonConforming, 1);
    assert.equal((await get(`/api/v1/inspection-templates/active?productId=${ids.product}`)).status, 200);
    const operatorToken = (await http.post('/api/v1/auth/login')
      .send({ email: 'op-read@example.invalid', password: 'prueba-read-api' })).body.data.accessToken;
    const created = await http.post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ code: 'PROV-NEW', name: 'Proveedor nuevo' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((await http.post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ code: 'PROV-NEW', name: 'Proveedor nuevo' })).status, 409);
    const statusChanged = await http.patch(`/api/v1/suppliers/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`).send({ active: false });
    assert.equal(statusChanged.status, 200, JSON.stringify(statusChanged.body));
    assert.equal(statusChanged.body.data.active, false);
    assert.equal((await get('/api/v1/suppliers')).status, 200);
    process.stdout.write('READ_API_ACTUAL=ok\n');
  } finally {
    if (app) await app.close();
    await mongo.close();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    process.env.DATABASE_URL = originalUrl;
    if (originalMongo === undefined) delete process.env.MONGODB_DATABASE;
    else process.env.MONGODB_DATABASE = originalMongo;
    if (originalWorker === undefined) delete process.env.OUTBOX_ENABLED;
    else process.env.OUTBOX_ENABLED = originalWorker;
  }
});
