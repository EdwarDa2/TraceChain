const { Client } = require('pg');
const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');

const required = ['DATABASE_URL', 'MONGODB_URI', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'];
if (required.some((name) => !process.env[name])) {
  throw new Error(`Faltan variables de integración: ${required.filter((name) => !process.env[name]).join(', ')}`);
}

const database = process.env.NEO4J_DATABASE ?? 'neo4j';
const expectedConstraints = [
  'proveedor_id_unique', 'producto_id_unique', 'lote_id_unique',
  'proceso_id_unique', 'distribucion_id_unique', 'ubicacion_id_unique',
  'suministro_id_unique', 'corresponde_id_unique', 'consumo_id_unique',
  'resultado_id_unique', 'detalle_distribucion_id_unique',
  'salida_distribucion_id_unique', 'entrega_distribucion_id_unique',
];
const expectedIndexes = [
  'proveedor_codigo_index', 'producto_codigo_index', 'lote_codigo_index',
  'proceso_codigo_index', 'distribucion_codigo_index', 'ubicacion_codigo_index',
];

test('PostgreSQL aislado responde una consulta parametrizada', async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    const result = await client.query('SELECT $1::integer AS ok', [1]);
    expect(result.rows[0].ok).toBe(1);
  } finally {
    await client.end();
  }
});

test('MongoDB aislado responde ping autenticado', async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    expect((await client.db('admin').command({ ping: 1 })).ok).toBe(1);
  } finally {
    await client.close();
  }
});

test('Neo4j aislado contiene el esquema oficial aplicado', async () => {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  try {
    const constraints = await driver.executeQuery(
      'SHOW CONSTRAINTS YIELD name WHERE name IN $names RETURN name',
      { names: expectedConstraints },
      { database },
    );
    expect(constraints.records.map((record) => record.get('name')).sort()).toEqual([...expectedConstraints].sort());

    const indexes = await driver.executeQuery(
      'SHOW INDEXES YIELD name, state WHERE name IN $names RETURN name, state',
      { names: expectedIndexes },
      { database },
    );
    expect(indexes.records.map((record) => [record.get('name'), record.get('state')]).sort()).toEqual(
      expectedIndexes.map((name) => [name, 'ONLINE']).sort(),
    );
  } finally {
    await driver.close();
  }
});
