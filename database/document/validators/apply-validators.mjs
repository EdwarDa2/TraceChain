// Aplica los validadores $jsonSchema a las tres colecciones oficiales.
// Requiere el driver mongodb 6.x del stack aprobado (a instalarse en BASE-01).
// Uso: MONGODB_URI=... [MONGODB_DATABASE=tracechain_quality] node database/document/validators/apply-validators.mjs
// No elimina colecciones: usa createCollection si no existen y collMod si ya existen.

import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';

const COLECCIONES = [
  { nombre: 'plantillas_inspeccion', archivo: 'plantillas-inspeccion.schema.json' },
  { nombre: 'inspecciones_calidad', archivo: 'inspecciones-calidad.schema.json' },
  { nombre: 'expedientes_incidencias', archivo: 'expedientes-incidencias.schema.json' }
];

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI es obligatorio');
  process.exit(1);
}

const nombreDb = process.env.MONGODB_DATABASE ?? 'tracechain_quality';
const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(nombreDb);

  for (const { nombre, archivo } of COLECCIONES) {
    const ruta = new URL(`./${archivo}`, import.meta.url);
    const validator = JSON.parse(await readFile(ruta, 'utf8'));
    if (!validator.$jsonSchema) {
      throw new Error(`${archivo} no contiene $jsonSchema`);
    }

    const existe = await db.listCollections({ name: nombre }, { nameOnly: true }).hasNext();
    if (existe) {
      await db.command({
        collMod: nombre,
        validator,
        validationLevel: 'strict',
        validationAction: 'error'
      });
      console.log(`Validador actualizado: ${nombre}`);
    } else {
      await db.createCollection(nombre, {
        validator,
        validationLevel: 'strict',
        validationAction: 'error'
      });
      console.log(`Colección creada con validador: ${nombre}`);
    }
  }
} finally {
  await client.close();
}
