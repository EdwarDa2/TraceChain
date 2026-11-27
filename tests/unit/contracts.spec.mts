import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANALYSIS_STATUSES,
  DATA_TYPES,
  EDGE_TYPES,
  ERROR_CODES,
  EVENT_TYPES,
  EVIDENCE_TYPES,
  FINDING_TYPES,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  LOCATION_TYPES,
  MOVEMENT_TYPES,
  NODE_TYPES,
  ORIGIN_TYPES,
  PRODUCT_TYPES,
  ROLES,
  SEVERITIES,
  SYNC_STATUSES,
  UNITS,
  WARNING_CODES,
  type EventEnvelope,
  type TraceabilityReader,
} from '../../packages/contracts/src/index.ts';

test('enums oficiales exportados desde el paquete compartido', () => {
  assert.deepEqual(ROLES, ['OPERADOR', 'ANALISTA_CALIDAD']);
  assert.deepEqual(PRODUCT_TYPES, ['MATERIA_PRIMA', 'INTERMEDIO', 'TERMINADO']);
  assert.deepEqual(UNITS, ['KG', 'G', 'L', 'ML', 'UNIDAD']);
  assert.deepEqual(LOCATION_TYPES, ['ALMACEN', 'PLANTA_PRODUCCION', 'SUCURSAL']);
  assert.deepEqual(ORIGIN_TYPES, ['RECEPCION', 'PRODUCCION']);
  assert.deepEqual(INCIDENT_STATUSES, ['ABIERTA', 'EN_ANALISIS', 'CERRADA']);
  assert.deepEqual(SYNC_STATUSES, ['PENDIENTE', 'SINCRONIZADO', 'ERROR']);
  assert.deepEqual(DATA_TYPES, ['TEXTO', 'ENTERO', 'DECIMAL', 'BOOLEANO', 'SELECCION']);
  assert.deepEqual(FINDING_TYPES, [
    'IMPUREZAS', 'HUMEDAD', 'PESO', 'EMPAQUE', 'APARIENCIA', 'TEXTURA', 'TEMPERATURA', 'OTRO',
  ]);
  assert.deepEqual(EVIDENCE_TYPES, ['IMAGEN', 'DOCUMENTO', 'REFERENCIA']);
  assert.deepEqual(MOVEMENT_TYPES, [
    'RECEPCION', 'CONSUMO_PRODUCCION', 'RESULTADO_PRODUCCION', 'DISTRIBUCION_SALIDA', 'DISTRIBUCION_ENTRADA',
  ]);
  assert.deepEqual(NODE_TYPES, ['Proveedor', 'Producto', 'Lote', 'Proceso', 'Distribucion', 'Ubicacion']);
  assert.deepEqual(EDGE_TYPES, [
    'SUMINISTRA', 'CORRESPONDE_A', 'UTILIZADO_EN', 'GENERA', 'INCLUIDO_EN', 'SALE_DE', 'ENTREGADO_A',
  ]);
  assert.deepEqual(ANALYSIS_STATUSES, ['COMPLETO', 'PARCIAL', 'NO_DISPONIBLE']);
  assert.deepEqual(SEVERITIES, ['BAJA', 'MEDIA', 'ALTA']);
  assert.deepEqual(INCIDENT_TYPES, ['CALIDAD', 'EMPAQUE', 'ALMACENAMIENTO', 'OTRO']);
});

test('catálogos de errores y advertencias oficiales', () => {
  for (const codigo of ['VALIDATION_ERROR', 'INSUFFICIENT_STOCK', 'LOT_NOT_IN_IMPACT',
    'VERSION_CONFLICT', 'GRAPH_SYNC_PENDING', 'GRAPH_INCONSISTENT', 'TEMPLATE_UNAVAILABLE', 'QUERY_TIMEOUT']) {
    assert.equal(ERROR_CODES.includes(codigo), true, `Falta código de error ${codigo}`);
  }
  assert.equal(ERROR_CODES.length, 36);
  for (const codigo of ['DEPTH_LIMIT', 'GRAPH_PENDING', 'QUALITY_UNAVAILABLE', 'TIME_LIMIT', 'DETAIL_LIMIT']) {
    assert.equal(WARNING_CODES.includes(codigo), true, `Falta advertencia ${codigo}`);
  }
});

test('eventos v1 con payloadVersion literal y destino Neo4j', () => {
  assert.deepEqual(EVENT_TYPES, [
    'PROVEEDOR_CREADO', 'PRODUCTO_CREADO', 'UBICACION_CREADA', 'CATALOGO_ACTUALIZADO',
    'LOTE_RECIBIDO', 'PRODUCCION_REGISTRADA', 'DISTRIBUCION_REGISTRADA',
    'INCIDENCIA_REGISTRADA', 'EXPEDIENTE_ACTUALIZADO',
  ]);
  const evento: EventEnvelope<'LOTE_RECIBIDO'> = {
    eventId: '00000000-0000-4000-8000-000000000001',
    sequence: '1',
    eventType: 'LOTE_RECIBIDO',
    entityType: 'LOT',
    entityId: '00000000-0000-4000-8000-000000000501',
    destination: 'NEO4J',
    payloadVersion: 1,
    occurredAt: '2026-11-25T20:00:00.000Z',
    payload: {
      lot: {
        id: '00000000-0000-4000-8000-000000000501',
        code: 'MP-001',
        productId: '00000000-0000-4000-8000-000000000301',
        originType: 'RECEPCION',
        originAt: '2026-11-25T15:00:00.000Z',
      },
      supplierId: '00000000-0000-4000-8000-000000000201',
    },
  };
  assert.equal(evento.payloadVersion, 1);
  assert.equal(evento.destination, 'NEO4J');
  assert.equal(JSON.parse(JSON.stringify(evento)).payload.lot.code, 'MP-001');
});

test('TraceabilityReader y sus tipos de entrada están en el contrato compartido', () => {
  const lector: TraceabilityReader = {
    forward: async () => { throw new Error('not implemented'); },
    backward: async () => { throw new Error('not implemented'); },
    commonOrigins: async () => { throw new Error('not implemented'); },
    paths: async () => { throw new Error('not implemented'); },
    verifyDescendant: async () => 'UNKNOWN',
  };
  assert.equal(typeof lector.verifyDescendant, 'function');
});
