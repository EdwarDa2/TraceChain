// Verificación estática de los artefactos documentales de I-2.
// NO sustituye a PM-01..23: no conecta a MongoDB y no valida comportamiento del motor.
// Uso: node database/document/tests/static-check.mjs

import { readFile } from 'node:fs/promises';

const raiz = new URL('../', import.meta.url);
const errores = [];
let verificaciones = 0;

function check(condicion, mensaje) {
  verificaciones += 1;
  if (!condicion) errores.push(mensaje);
}

async function leer(rutaRelativa) {
  return readFile(new URL(rutaRelativa, raiz), 'utf8');
}

async function leerJson(rutaRelativa) {
  return JSON.parse(await leer(rutaRelativa));
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CLAVE_PARAMETRO = /^[a-z][a-z0-9_]*$/;

const esquemas = [
  { archivo: 'validators/plantillas-inspeccion.schema.json', requeridos: ['_id', 'codigo', 'nombre', 'producto_id', 'version', 'parametros', 'activo', 'created_at'] },
  { archivo: 'validators/inspecciones-calidad.schema.json', requeridos: ['_id', 'codigo', 'lote_id', 'producto_id', 'plantilla_id', 'plantilla_version', 'inspector_id', 'fecha_inspeccion', 'parametros', 'resultado', 'hallazgos', 'evidencias', 'idempotency_key', 'request_hash', 'created_at'] },
  { archivo: 'validators/expedientes-incidencias.schema.json', requeridos: ['_id', 'incidencia_id', 'descripcion', 'inspecciones_ids', 'hallazgos', 'evidencias', 'version', 'ultimo_evento_id', 'created_at', 'updated_at'] }
];

for (const { archivo, requeridos } of esquemas) {
  const esquema = await leerJson(archivo);
  const nodo = esquema.$jsonSchema;
  check(!!nodo, `${archivo}: falta $jsonSchema`);
  if (!nodo) continue;
  check(nodo.bsonType === 'object', `${archivo}: bsonType debe ser object`);
  check(nodo.additionalProperties === false, `${archivo}: additionalProperties debe ser false`);
  check(nodo.title?.startsWith('E-'), `${archivo}: falta título de entidad`);
  for (const campo of requeridos) {
    check(nodo.required?.includes(campo), `${archivo}: ${campo} no es requerido`);
    check(!!nodo.properties?.[campo], `${archivo}: falta propiedad ${campo}`);
  }
  check(JSON.stringify(nodo.required) === JSON.stringify(requeridos), `${archivo}: la lista required no coincide con DATA_MODEL §3`);
}

const plantillas = await leerJson('data/plantillas-inspeccion.json');
check(Array.isArray(plantillas) && plantillas.length === 6, 'Deben existir exactamente 6 plantillas v1');

const esperadas = {
  'TPL-HARINA': { producto: '301', claves: ['humedad', 'color', 'impurezas', 'empaque'] },
  'TPL-AZUCAR': { producto: '302', claves: ['humedad', 'color', 'grumos', 'impurezas'] },
  'TPL-MASA': { producto: '304', claves: ['temperatura', 'textura', 'consistencia'] },
  'TPL-PAN': { producto: '306', claves: ['peso', 'textura', 'empaque'] },
  'TPL-GALLETAS': { producto: '307', claves: ['peso', 'piezas_danadas', 'textura', 'empaque'] },
  'TPL-GENERAL': { producto: null, claves: ['apariencia', 'estado', 'anomalias'] }
};

const opcionesEsperadas = {
  'TPL-HARINA:color': ['BLANCO', 'CREMA', 'OTRO'],
  'TPL-AZUCAR:color': ['BLANCO', 'CREMA', 'OTRO'],
  'TPL-HARINA:empaque': ['INTEGRO', 'DANADO'],
  'TPL-PAN:empaque': ['INTEGRO', 'DANADO'],
  'TPL-GALLETAS:empaque': ['INTEGRO', 'DANADO'],
  'TPL-MASA:textura': ['SUAVE', 'FIRME', 'IRREGULAR'],
  'TPL-PAN:textura': ['SUAVE', 'FIRME', 'IRREGULAR'],
  'TPL-GALLETAS:textura': ['CRUJIENTE', 'BLANDA', 'IRREGULAR'],
  'TPL-MASA:consistencia': ['HOMOGENEA', 'HETEROGENEA'],
  'TPL-GENERAL:estado': ['NORMAL', 'IRREGULAR']
};

const tiposValidos = ['TEXTO', 'ENTERO', 'DECIMAL', 'BOOLEANO', 'SELECCION'];
const sufijosVistos = new Set();

for (const plantilla of plantillas) {
  const { codigo } = plantilla;
  const esperada = esperadas[codigo];
  check(!!esperada, `${codigo}: código no oficial`);
  if (!esperada) continue;

  check(UUID_V4.test(plantilla._id), `${codigo}: _id no es UUID v4`);
  const sufijo = plantilla._id.slice(-3);
  check(!sufijosVistos.has(sufijo), `${codigo}: sufijo de UUID repetido`);
  sufijosVistos.add(sufijo);
  check(plantilla.version === 1, `${codigo}: versión debe ser 1`);
  check(plantilla.activo === true, `${codigo}: debe estar activa`);
  check(!Number.isNaN(Date.parse(plantilla.created_at)), `${codigo}: created_at inválido`);
  check(
    esperada.producto === null ? plantilla.producto_id === null : plantilla.producto_id?.endsWith(esperada.producto),
    `${codigo}: producto_id incorrecto`
  );

  const claves = plantilla.parametros.map((p) => p.key);
  check(JSON.stringify(claves) === JSON.stringify(esperada.claves), `${codigo}: parámetros incorrectos`);
  check(new Set(claves).size === claves.length, `${codigo}: claves de parámetro duplicadas`);
  check(claves.length >= 1 && claves.length <= 30, `${codigo}: número de parámetros fuera de 1..30`);

  for (const parametro of plantilla.parametros) {
    const id = `${codigo}:${parametro.key}`;
    check(CLAVE_PARAMETRO.test(parametro.key), `${id}: clave con formato inválido`);
    check(parametro.label.length >= 1 && parametro.label.length <= 150, `${id}: etiqueta inválida`);
    check(tiposValidos.includes(parametro.dataType), `${id}: dataType no oficial`);
    check(parametro.required === true, `${id}: todos los parámetros de v1 son requeridos`);
    check(Array.isArray(parametro.options), `${id}: options debe ser arreglo`);
    check(
      parametro.dataType === 'SELECCION'
        ? parametro.options.length > 0 && new Set(parametro.options).size === parametro.options.length
        : parametro.options.length === 0,
      `${id}: options inconsistentes con dataType`
    );
    const opciones = opcionesEsperadas[id];
    if (opciones) {
      check(JSON.stringify(parametro.options) === JSON.stringify(opciones), `${id}: opciones incorrectas`);
    }
    if (['TEXTO', 'BOOLEANO'].includes(parametro.dataType)) {
      check(parametro.min === null && parametro.max === null, `${id}: límites no aplicables`);
    }
    if (parametro.min !== null && parametro.max !== null) {
      check(Number(parametro.min) <= Number(parametro.max), `${id}: min > max`);
    }
  }
}

const humedad = plantillas.find((p) => p.codigo === 'TPL-HARINA').parametros.find((p) => p.key === 'humedad');
check(humedad.min === '0.000' && humedad.max === '100.000', 'TPL-HARINA:humedad debe tener límites 0.000..100.000');
const piezas = plantillas.find((p) => p.codigo === 'TPL-GALLETAS').parametros.find((p) => p.key === 'piezas_danadas');
check(piezas.dataType === 'ENTERO' && piezas.min === '0', 'TPL-GALLETAS:piezas_danadas debe ser ENTERO con mínimo 0');

const indices = await leer('indexes/create-indexes.mongosh.js');
check((indices.match(/createIndex\(/g) ?? []).length === 10, 'Deben declararse 10 índices explícitos');
for (const nombre of [
  'uq_codigo_version', 'uq_producto_activo', 'uq_codigo', 'idx_lote_fecha',
  'idx_producto_resultado_fecha', 'idx_resultado_fecha', 'idx_hallazgos_tipo',
  'uq_inspector_idempotency', 'uq_incidencia', 'idx_inspecciones_ids'
]) {
  check(indices.includes(nombre), `Falta el índice ${nombre}`);
}
check(indices.includes('partialFilterExpression: { activo: true }'), 'Falta el filtro parcial de plantilla activa');

const aplicador = await leer('validators/apply-validators.mjs');
check((aplicador.match(/nombre: '/g) ?? []).length === 3, 'El aplicador debe cubrir 3 colecciones');
for (const archivo of ['plantillas-inspeccion.schema.json', 'inspecciones-calidad.schema.json', 'expedientes-incidencias.schema.json']) {
  check(aplicador.includes(archivo), `El aplicador no referencia ${archivo}`);
}
check(aplicador.includes("validationLevel: 'strict'") && aplicador.includes("validationAction: 'error'"), 'Validadores deben ser strict/error');
check(!aplicador.includes('dropDatabase') && !aplicador.includes('deleteMany'), 'El aplicador no debe borrar datos');

const sembrador = await leer('data/seed-templates.mjs');
check(sembrador.includes('$setOnInsert'), 'La carga de plantillas debe preservar documentos existentes');
check(sembrador.includes('Decimal128.fromString'), 'Los límites DECIMAL deben convertirse a Decimal128');
check(sembrador.includes('Number.parseInt'), 'Los límites ENTERO deben convertirse a Int32');
check(!/mongodb:\/\/[^"'\s]+/.test(sembrador + aplicador), 'No se permite URI con credenciales en el código');

if (errores.length > 0) {
  console.error(`FALLÓ: ${errores.length} de ${verificaciones} verificaciones`);
  for (const error of errores) console.error(` - ${error}`);
  process.exitCode = 1;
} else {
  console.log(`OK: ${verificaciones} verificaciones estáticas superadas`);
  console.log('PM-01..23 siguen NOT_RUN: requieren MongoDB real (BASE-02).');
}
