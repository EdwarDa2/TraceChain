import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countFindings,
  createQualityReader,
  summarizeByProduct,
  summarizeLots,
  summarizeQuality,
  type Finding,
  type Inspection,
  type InspectionResult,
} from './quality-aggregations.mts';

function hallazgo(tipo: Finding['type'], severidad: Finding['severity']): Finding {
  return { type: tipo, parameter: null, description: 'Hallazgo ficticio', severity: severidad };
}

function inspeccion(
  id: string,
  lotId: string,
  productId: string,
  inspectedAt: string,
  result: InspectionResult,
  findings: Finding[] = [],
): Inspection {
  return {
    id,
    code: `INS-${id.slice(-4)}`,
    lotId,
    productId,
    inspectedAt,
    result,
    findings,
  };
}

test('resumen vacío: conteos cero y porcentaje null (RN-127)', () => {
  assert.deepEqual(summarizeQuality([]), {
    total: 0,
    conforming: 0,
    nonConforming: 0,
    nonConformingPercentage: null,
  });
});

test('porcentaje de no conformes con dos decimales', () => {
  const tresNoConformes = [
    inspeccion('1', 'l1', 'p1', '2026-11-25T19:00:00Z', 'NO_CONFORME'),
    inspeccion('2', 'l2', 'p1', '2026-11-25T19:01:00Z', 'NO_CONFORME'),
    inspeccion('3', 'l3', 'p1', '2026-11-25T19:02:00Z', 'NO_CONFORME'),
    inspeccion('4', 'l4', 'p1', '2026-11-25T19:03:00Z', 'CONFORME'),
  ];
  assert.equal(summarizeQuality(tresNoConformes).nonConformingPercentage, 75);

  const tercio = [
    tresNoConformes[0]!,
    inspeccion('5', 'l5', 'p1', '2026-11-25T19:04:00Z', 'CONFORME'),
    inspeccion('6', 'l6', 'p1', '2026-11-25T19:05:00Z', 'CONFORME'),
  ];
  assert.equal(summarizeQuality(tercio).nonConformingPercentage, 33.33);
});

test('resumen por producto incluye productos sin inspecciones y usa nombres de PG', () => {
  const inspecciones = [
    inspeccion('1', 'l1', 'p1', '2026-11-25T19:00:00Z', 'NO_CONFORME'),
    inspeccion('2', 'l2', 'p1', '2026-11-25T19:01:00Z', 'CONFORME'),
    inspeccion('3', 'l3', 'p3', '2026-11-25T19:02:00Z', 'NO_CONFORME'),
  ];
  const resultado = summarizeByProduct(inspecciones, [
    { id: 'p1', name: 'Harina' },
    { id: 'p2', name: 'Azúcar' },
  ]);

  assert.deepEqual(resultado.byProduct.map((fila) => [fila.productId, fila.productName, fila.total, fila.nonConformingPercentage]), [
    ['p1', 'Harina', 2, 50],
    ['p2', 'Azúcar', 0, null],
  ]);
  assert.equal(resultado.total, 2);
  assert.equal(resultado.nonConforming, 1);
});

test('hallazgos se cuentan por elemento del arreglo, ordenados por count y clave', () => {
  const inspecciones = [
    inspeccion('1', 'l1', 'p1', '2026-11-25T19:00:00Z', 'NO_CONFORME', [
      hallazgo('APARIENCIA', 'MEDIA'),
      hallazgo('APARIENCIA', 'MEDIA'),
      hallazgo('IMPUREZAS', 'ALTA'),
    ]),
  ];

  assert.deepEqual(countFindings(inspecciones, 'type'), [
    { key: 'APARIENCIA', count: 2 },
    { key: 'IMPUREZAS', count: 1 },
  ]);
  assert.deepEqual(countFindings(inspecciones, 'severity'), [
    { key: 'MEDIA', count: 2 },
    { key: 'ALTA', count: 1 },
  ]);
});

test('empate en count se desempata por clave ascendente', () => {
  const inspecciones = [
    inspeccion('1', 'l1', 'p1', '2026-11-25T19:00:00Z', 'NO_CONFORME', [
      hallazgo('IMPUREZAS', 'ALTA'),
      hallazgo('APARIENCIA', 'ALTA'),
    ]),
  ];
  assert.deepEqual(countFindings(inspecciones, 'type').map((fila) => fila.key), ['APARIENCIA', 'IMPUREZAS']);
});

test('límite de hallazgos por defecto 20 y rango 1..100', () => {
  const inspecciones = [
    inspeccion('1', 'l1', 'p1', '2026-11-25T19:00:00Z', 'NO_CONFORME', [
      hallazgo('APARIENCIA', 'MEDIA'),
      hallazgo('IMPUREZAS', 'ALTA'),
    ]),
  ];
  assert.equal(countFindings(inspecciones, 'type', 1).length, 1);
  assert.throws(() => countFindings(inspecciones, 'type', 0), RangeError);
  assert.throws(() => countFindings(inspecciones, 'type', 101), RangeError);
});

test('resumen por lote devuelve ceros para lotes sin inspecciones', () => {
  assert.deepEqual(summarizeLots(['lSin'], []), [{
    lotId: 'lSin',
    totalInspections: 0,
    conforming: 0,
    nonConforming: 0,
    latestInspectionId: null,
  }]);
});

test('última inspección por fecha con desempate determinista', () => {
  const inspecciones = [
    inspeccion('aaa1', 'l1', 'p1', '2026-11-25T19:00:00Z', 'CONFORME'),
    inspeccion('bbb2', 'l1', 'p1', '2026-11-25T18:00:00Z', 'NO_CONFORME'),
    inspeccion('ccc3', 'l2', 'p1', '2026-11-25T21:00:00Z', 'CONFORME'),
  ];
  const resultado = summarizeLots(['l1', 'l2'], inspecciones);
  assert.equal(resultado[0]!.latestInspectionId, 'aaa1');
  assert.equal(resultado[0]!.nonConforming, 1);
  assert.equal(resultado[1]!.latestInspectionId, 'ccc3');
});

test('QualityReader delega lecturas y no convierte ausencia en arreglo vacío', async () => {
  const inspecciones = [inspeccion('1', 'l1', 'p1', '2026-11-25T19:00:00Z', 'NO_CONFORME')];
  const llamadas: string[] = [];
  const reader = createQualityReader({
    inspectionById: async (id) => {
      llamadas.push(`inspection:${id}`);
      return id === '1' ? inspecciones[0]! : null;
    },
    inspectionsByIds: async (ids) => {
      llamadas.push(`byIds:${ids.join(',')}`);
      return inspecciones.filter((item) => ids.includes(item.lotId));
    },
    dossierByIncident: async (id) => {
      llamadas.push(`dossier:${id}`);
      return { dossierStatus: 'SINCRONIZADO', status: 'COMPLETO', dossier: null, inspections: inspecciones, warnings: [] };
    },
  });

  assert.equal(await reader.inspection('2'), null);
  const resumen = await reader.summarizeLots(['l1', 'lSin']);
  assert.equal(resumen[0]!.totalInspections, 1);
  assert.equal(resumen[1]!.totalInspections, 0);
  const dossier = await reader.dossier('inc1');
  assert.equal(dossier.inspections?.length, 1);
  assert.deepEqual(llamadas, ['inspection:2', 'byIds:l1,lSin', 'dossier:inc1']);
});
