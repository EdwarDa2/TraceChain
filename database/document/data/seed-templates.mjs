// Carga las seis plantillas v1 tras aplicar validadores e índices.
// Requiere driver mongodb 6.x (BASE-01) y MONGODB_URI (BASE-02).
// Uso: MONGODB_URI=... node database/document/data/seed-templates.mjs
// Las plantillas son inmutables: los documentos existentes nunca se sobrescriben (RN-54, AI-09).

import { readFile } from 'node:fs/promises';
import { MongoClient, Decimal128 } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI es obligatorio');
  process.exit(1);
}

const nombreDb = process.env.MONGODB_DATABASE ?? 'tracechain_quality';
const datos = JSON.parse(await readFile(new URL('./plantillas-inspeccion.json', import.meta.url), 'utf8'));

function convertirLimite(valor, dataType) {
  if (valor === null) return null;
  if (dataType === 'ENTERO') return Number.parseInt(valor, 10);
  if (dataType === 'DECIMAL') return Decimal128.fromString(valor);
  return null;
}

function aDocumento(plantilla) {
  return {
    ...plantilla,
    created_at: new Date(plantilla.created_at),
    parametros: plantilla.parametros.map((parametro) => ({
      ...parametro,
      min: convertirLimite(parametro.min, parametro.dataType),
      max: convertirLimite(parametro.max, parametro.dataType)
    }))
  };
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const coleccion = client.db(nombreDb).collection('plantillas_inspeccion');
  let insertadas = 0;
  let existentes = 0;

  for (const plantilla of datos) {
    const resultado = await coleccion.updateOne(
      { _id: plantilla._id },
      { $setOnInsert: aDocumento(plantilla) },
      { upsert: true }
    );
    if (resultado.upsertedCount === 1) insertadas += 1;
    else existentes += 1;
  }

  console.log(`Plantillas insertadas: ${insertadas}; ya existentes: ${existentes}; total: ${datos.length}`);
} finally {
  await client.close();
}
