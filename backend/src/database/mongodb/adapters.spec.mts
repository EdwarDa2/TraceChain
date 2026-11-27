import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMongoDossierStore,
  createMongoQualityPorts,
  dossierADocumento,
  type MongoDocumento,
  type MongoLikeCollection,
  type MongoLikeDb,
} from './adapters.mts';
import {
  createDossier,
  type IncidenciaRegistradaEvent,
} from '../../modules/incidents/dossier.mts';

const NOW = '2026-11-25T20:00:00.000Z';
const INCIDENTE = '00000000-0000-4000-8000-000000001001';
const DOSSIER = '00000000-0000-4000-8000-000000001101';
const INSPECCION = '00000000-0000-4000-8000-000000000901';
const EVENTO = '11111111-1111-4111-8111-111111111111';

function coincide(documento: MongoDocumento, filtro: Record<string, unknown>): boolean {
  for (const [clave, valor] of Object.entries(filtro)) {
    if (valor !== null && typeof valor === 'object' && !Array.isArray(valor) && '$in' in valor) {
      const permitidos = (valor as { $in: unknown[] }).$in;
      if (!permitidos.includes(documento[clave])) return false;
      continue;
    }
    if (documento[clave] !== valor) return false;
  }
  return true;
}

function iso(valor: unknown): string {
  return valor instanceof Date ? valor.toISOString() : String(valor ?? '');
}

class ColeccionFalsa implements MongoLikeCollection {
  documentos: MongoDocumento[] = [];
  actualizaciones: { filtro: Record<string, unknown>; actualizacion: Record<string, unknown> }[] = [];

  async findOne(filtro: Record<string, unknown>): Promise<MongoDocumento | null> {
    return this.documentos.find((documento) => coincide(documento, filtro)) ?? null;
  }

  find(filtro: Record<string, unknown>) {
    return {
      sort: (_orden: Record<string, 1 | -1>) => ({
        toArray: async (): Promise<MongoDocumento[]> =>
          this.documentos
            .filter((documento) => coincide(documento, filtro))
            .sort((a, b) => iso(b.fecha_inspeccion).localeCompare(iso(a.fecha_inspeccion))),
      }),
    };
  }

  async insertOne(documento: MongoDocumento): Promise<unknown> {
    if (this.documentos.some((actual) => actual._id === documento._id || actual.incidencia_id === documento.incidencia_id)) {
      throw { code: 11000, codeName: 'DuplicateKey' };
    }
    this.documentos.push({ ...documento });
    return {};
  }

  async updateOne(filtro: Record<string, unknown>, actualizacion: Record<string, unknown>) {
    this.actualizaciones.push({ filtro, actualizacion });
    const encontrados = this.documentos.filter((documento) => coincide(documento, filtro));
    if (encontrados.length === 0) return { matchedCount: 0 };
    Object.assign(encontrados[0]!, (actualizacion.$set as MongoDocumento) ?? {});
    return { matchedCount: encontrados.length };
  }
}

function baseDeDatosFalsa() {
  const colecciones = new Map<string, ColeccionFalsa>();
  const db: MongoLikeDb = {
    collection(nombre) {
      if (!colecciones.has(nombre)) colecciones.set(nombre, new ColeccionFalsa());
      return colecciones.get(nombre)!;
    },
  };
  return { db, coleccion: (nombre: string) => db.collection(nombre) as ColeccionFalsa };
}

function evento(): IncidenciaRegistradaEvent {
  return {
    eventId: EVENTO,
    eventType: 'INCIDENCIA_REGISTRADA',
    payloadVersion: 1,
    occurredAt: NOW,
    payload: {
      incidentId: INCIDENTE,
      dossierId: DOSSIER,
      version: 1,
      fields: {
        description: 'Investigación ficticia',
        inspectionIds: [],
        findings: [],
        evidence: [{ type: 'REFERENCIA', reference: 'REF-1', description: null, registeredAt: '2020-01-01T00:00:00Z' }],
        notes: null,
        detailedResolution: null,
      },
    },
  };
}

test('round-trip del expediente: insertar y leer por incidencia conserva los campos', async () => {
  const { db } = baseDeDatosFalsa();
  const store = createMongoDossierStore(db);
  const original = createDossier(evento(), NOW);
  assert.equal(await store.insert(original), true);

  const leido = await store.findByIncident(INCIDENTE);
  assert.deepEqual(leido, original);
  assert.equal(leido?.evidence[0]?.registeredAt, NOW);
});

test('inserción duplicada por UQ(incidencia_id) se reporta sin escribir', async () => {
  const { db } = baseDeDatosFalsa();
  const store = createMongoDossierStore(db);
  const original = createDossier(evento(), NOW);
  assert.equal(await store.insert(original), true);
  assert.equal(await store.insert(original), false);
  assert.equal((await store.findByIncident(INCIDENTE))?.version, 1);
});

test('CAS usa versión esperada y nunca incluye _id en $set', async () => {
  const { db, coleccion } = baseDeDatosFalsa();
  const store = createMongoDossierStore(db);
  const original = createDossier(evento(), NOW);
  await store.insert(original);

  const siguiente = { ...original, version: 2, notes: 'Nota ficticia', ultimoEventoId: EVENTO };
  assert.equal(await store.cas(INCIDENTE, 2, siguiente), false);
  assert.equal(await store.cas(INCIDENTE, 1, siguiente), true);

  const escrito = coleccion('expedientes_incidencias').actualizaciones.at(-1)!;
  assert.deepEqual(escrito.filtro, { incidencia_id: INCIDENTE, version: 1 });
  assert.equal('$set' in escrito.actualizacion, true);
  assert.equal((escrito.actualizacion.$set as MongoDocumento)._id, undefined);
  assert.equal((await store.findByIncident(INCIDENTE))?.version, 2);
  assert.equal((await store.findByIncident(INCIDENTE))?.notes, 'Nota ficticia');
});

test('documento convertido a BSON usa snake_case y fechas Date', () => {
  const documento = dossierADocumento(createDossier(evento(), NOW));
  assert.equal(documento._id, DOSSIER);
  assert.equal(documento.incidencia_id, INCIDENTE);
  assert.equal(documento.ultimo_evento_id, EVENTO);
  assert.equal(documento.created_at instanceof Date, true);
  assert.equal(documento.evidencias !== undefined, true);
});

test('QualityReader sobre Mongo: lectura por ids y vista de expediente', async () => {
  const { db } = baseDeDatosFalsa();
  const expedientes = db.collection('expedientes_incidencias');
  await expedientes.insertOne({
    _id: DOSSIER,
    incidencia_id: INCIDENTE,
    descripcion: 'Expediente ficticio',
    inspecciones_ids: [INSPECCION],
    hallazgos: [],
    evidencias: [],
    observaciones: null,
    resolucion_detallada: null,
    version: 1,
    ultimo_evento_id: EVENTO,
    created_at: new Date(NOW),
    updated_at: new Date(NOW),
  });
  const inspecciones = db.collection('inspecciones_calidad');
  await inspecciones.insertOne({
    _id: INSPECCION,
    codigo: 'INS-0901',
    lote_id: '00000000-0000-4000-8000-000000000501',
    producto_id: '00000000-0000-4000-8000-000000000301',
    plantilla_id: '00000000-0000-4000-8000-000000000801',
    plantilla_version: 1,
    inspector_id: '00000000-0000-4000-8000-000000000102',
    fecha_inspeccion: new Date(NOW),
    parametros: { humedad: '16.5' },
    resultado: 'NO_CONFORME',
    hallazgos: [{ tipo: 'IMPUREZAS', parametro: 'impurezas', descripcion: 'Hallazgo ficticio', severidad: 'ALTA' }],
    observaciones: null,
    evidencias: [],
    idempotency_key: EVENTO,
    request_hash: 'a'.repeat(64),
    created_at: new Date(NOW),
  });

  const puertos = createMongoQualityPorts(db);
  assert.equal(await puertos.inspectionById('inexistente'), null);
  const inspeccion = await puertos.inspectionById(INSPECCION);
  assert.equal(inspeccion?.result, 'NO_CONFORME');
  assert.equal(inspeccion?.findings[0]?.type, 'IMPUREZAS');

  const porIds = await puertos.inspectionsByIds([INSPECCION]);
  assert.equal(porIds.length, 1);
  assert.deepEqual(await puertos.inspectionsByIds([]), []);

  const vista = await puertos.dossierByIncident(INCIDENTE);
  assert.equal(vista.dossierStatus, 'SINCRONIZADO');
  assert.equal(vista.inspections?.length, 1);
  assert.equal(vista.inspections?.[0]?.id, INSPECCION);
});

test('vista de expediente sin documento queda PENDIENTE y sin inspecciones', async () => {
  const { db } = baseDeDatosFalsa();
  const vista = await createMongoQualityPorts(db).dossierByIncident(INCIDENTE);
  assert.equal(vista.dossierStatus, 'PENDIENTE');
  assert.equal(vista.status, 'PARCIAL');
  assert.equal(vista.dossier, null);
  assert.equal(vista.inspections, null);
});
