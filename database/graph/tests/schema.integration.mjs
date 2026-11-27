import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import neo4j from 'neo4j-driver';

const requiredEnvironment = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
  throw new Error(`Variables obligatorias ausentes: ${missingEnvironment.join(', ')}`);
}

const database = process.env.NEO4J_DATABASE ?? 'neo4j';
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
);

const EXPECTED_CONSTRAINTS = new Map([
  ['proveedor_id_unique', ['Proveedor']],
  ['producto_id_unique', ['Producto']],
  ['lote_id_unique', ['Lote']],
  ['proceso_id_unique', ['Proceso']],
  ['distribucion_id_unique', ['Distribucion']],
  ['ubicacion_id_unique', ['Ubicacion']],
  ['suministro_id_unique', ['SUMINISTRA']],
  ['corresponde_id_unique', ['CORRESPONDE_A']],
  ['consumo_id_unique', ['UTILIZADO_EN']],
  ['resultado_id_unique', ['GENERA']],
  ['detalle_distribucion_id_unique', ['INCLUIDO_EN']],
  ['salida_distribucion_id_unique', ['SALE_DE']],
  ['entrega_distribucion_id_unique', ['ENTREGADO_A']],
]);

const EXPECTED_INDEXES = new Map([
  ['proveedor_codigo_index', ['Proveedor']],
  ['producto_codigo_index', ['Producto']],
  ['lote_codigo_index', ['Lote']],
  ['proceso_codigo_index', ['Proceso']],
  ['distribucion_codigo_index', ['Distribucion']],
  ['ubicacion_codigo_index', ['Ubicacion']],
]);

after(async () => {
  await driver.close();
});

test('Neo4j contiene las 13 constraints oficiales sobre id', async () => {
  const result = await driver.executeQuery(
    `SHOW CONSTRAINTS
     YIELD name, labelsOrTypes, properties
     WHERE name IN $names
     RETURN name, labelsOrTypes, properties
     ORDER BY name`,
    { names: [...EXPECTED_CONSTRAINTS.keys()] },
    { database },
  );

  assert.equal(result.records.length, EXPECTED_CONSTRAINTS.size);
  for (const record of result.records) {
    const name = record.get('name');
    assert.deepEqual(record.get('labelsOrTypes'), EXPECTED_CONSTRAINTS.get(name));
    assert.deepEqual(record.get('properties'), ['id']);
  }
});

test('Neo4j contiene los seis índices de código en estado ONLINE', async () => {
  const result = await driver.executeQuery(
    `SHOW INDEXES
     YIELD name, labelsOrTypes, properties, state
     WHERE name IN $names
     RETURN name, labelsOrTypes, properties, state
     ORDER BY name`,
    { names: [...EXPECTED_INDEXES.keys()] },
    { database },
  );

  assert.equal(result.records.length, EXPECTED_INDEXES.size);
  for (const record of result.records) {
    const name = record.get('name');
    assert.deepEqual(record.get('labelsOrTypes'), EXPECTED_INDEXES.get(name));
    assert.deepEqual(record.get('properties'), ['codigo']);
    assert.equal(record.get('state'), 'ONLINE');
  }
});
