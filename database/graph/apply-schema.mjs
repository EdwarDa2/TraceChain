// Aplicador idempotente del esquema Neo4j de I-3.
// Uso: NEO4J_URI=... NEO4J_USER=... NEO4J_PASSWORD=... node database/graph/apply-schema.mjs

import { readdir, readFile } from 'node:fs/promises';
import neo4j from 'neo4j-driver';

const requiredEnvironment = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
  console.error(`Variables obligatorias ausentes: ${missingEnvironment.join(', ')}`);
  process.exit(1);
}

const schemaDirectory = new URL('./schema/', import.meta.url);
const database = process.env.NEO4J_DATABASE ?? 'neo4j';
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
);

function statementsFrom(contents) {
  return contents
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

try {
  await driver.verifyConnectivity();
  const files = (await readdir(schemaDirectory))
    .filter((name) => /^\d+_.*\.cypher$/.test(name))
    .sort();

  for (const file of files) {
    const contents = await readFile(new URL(file, schemaDirectory), 'utf8');
    for (const statement of statementsFrom(contents)) {
      await driver.executeQuery(statement, {}, { database });
    }
    console.log(`Aplicado: ${file}`);
  }
} finally {
  await driver.close();
}
