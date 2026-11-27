import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const BASE = new URL('../', import.meta.url);
const SCHEMA_FILES = [
  '001_node_constraints.cypher',
  '002_relationship_constraints.cypher',
  '003_indexes.cypher',
] as const;
const NODE_LABELS = ['Proveedor', 'Producto', 'Lote', 'Proceso', 'Distribucion', 'Ubicacion'] as const;
const RELATIONSHIP_TYPES = [
  'SUMINISTRA',
  'CORRESPONDE_A',
  'UTILIZADO_EN',
  'GENERA',
  'INCLUIDO_EN',
  'SALE_DE',
  'ENTREGADO_A',
] as const;

async function readSchema(file: (typeof SCHEMA_FILES)[number]): Promise<string> {
  return readFile(new URL(`schema/${file}`, BASE), 'utf8');
}

test('existen los tres scripts de esquema numerados y el aplicador', async () => {
  for (const file of SCHEMA_FILES) {
    const contents = await readSchema(file);
    assert.ok(contents.trim().length > 0, `${file} está vacío`);
  }

  const runner = await readFile(new URL('apply-schema.mjs', BASE), 'utf8');
  assert.match(runner, /NEO4J_URI/);
  assert.match(runner, /executeQuery/);
});

test('crea exactamente seis constraints de unicidad para nodos', async () => {
  const cypher = await readSchema('001_node_constraints.cypher');
  const constraints = cypher.match(/CREATE CONSTRAINT/gi) ?? [];
  assert.equal(constraints.length, NODE_LABELS.length);

  for (const label of NODE_LABELS) {
    assert.match(
      cypher,
      new RegExp(`FOR\\s*\\(n:${label}\\)\\s*REQUIRE\\s+n\\.id\\s+IS\\s+UNIQUE`, 'i'),
      `Falta constraint de ${label}.id`,
    );
  }
});

test('crea exactamente siete constraints de unicidad para relaciones', async () => {
  const cypher = await readSchema('002_relationship_constraints.cypher');
  const constraints = cypher.match(/CREATE CONSTRAINT/gi) ?? [];
  assert.equal(constraints.length, RELATIONSHIP_TYPES.length);

  for (const type of RELATIONSHIP_TYPES) {
    assert.match(
      cypher,
      new RegExp(`FOR\\s*\\(\\)-\\[r:${type}\\]-\\(\\)\\s*REQUIRE\\s+r\\.id\\s+IS\\s+UNIQUE`, 'i'),
      `Falta constraint de ${type}.id`,
    );
  }
});

test('crea un índice de código para cada etiqueta y ningún tipo adicional', async () => {
  const cypher = await readSchema('003_indexes.cypher');
  const indexes = cypher.match(/CREATE INDEX/gi) ?? [];
  assert.equal(indexes.length, NODE_LABELS.length);

  for (const label of NODE_LABELS) {
    assert.match(
      cypher,
      new RegExp(`FOR\\s*\\(n:${label}\\)\\s*ON\\s*\\(n\\.codigo\\)`, 'i'),
      `Falta índice de ${label}.codigo`,
    );
  }

  const allCypher = (await Promise.all(SCHEMA_FILES.map(readSchema))).join('\n');
  for (const forbidden of ['Inspeccion', 'Incidencia', 'Bloqueo', 'Stock']) {
    assert.doesNotMatch(allCypher, new RegExp(`:${forbidden}\\b`), `Etiqueta no autorizada: ${forbidden}`);
  }
});
