import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareDecimals,
  validateInspectionParameters,
  validateTemplate,
  type Parameters,
  type TemplateParameter,
} from './parameters.validator.mts';

function parametro(
  key: string,
  dataType: TemplateParameter['dataType'],
  opciones: string[] = [],
  min: string | null = null,
  max: string | null = null,
  required = true,
): TemplateParameter {
  return { key, label: key, dataType, unit: null, required, options: opciones, min, max };
}

const harina: TemplateParameter[] = [
  parametro('humedad', 'DECIMAL', [], '0.000', '100.000'),
  parametro('color', 'SELECCION', ['BLANCO', 'CREMA', 'OTRO']),
  parametro('impurezas', 'BOOLEANO'),
  parametro('empaque', 'SELECCION', ['INTEGRO', 'DANADO']),
];

const galletas: TemplateParameter[] = [
  parametro('peso', 'DECIMAL', [], '0.000'),
  parametro('piezas_danadas', 'ENTERO', [], '0'),
  parametro('textura', 'SELECCION', ['CRUJIENTE', 'BLANDA', 'IRREGULAR']),
  parametro('empaque', 'SELECCION', ['INTEGRO', 'DANADO']),
];

const valoresHarina: Parameters = {
  humedad: '16.5',
  color: 'BLANCO',
  impurezas: true,
  empaque: 'INTEGRO',
};

const codigos = (resultado: { ok: false; issues: { code: string }[] }) =>
  resultado.issues.map((issue) => issue.code);

test('acepta la inspección de harina del fixture sin alterar los valores', () => {
  const resultado = validateInspectionParameters(harina, valoresHarina);
  assert.equal(resultado.ok, true);
  if (resultado.ok) assert.deepEqual(resultado.values, valoresHarina);
});

test('rechaza parámetro requerido ausente (PM-05)', () => {
  const resultado = validateInspectionParameters(harina, { color: 'BLANCO', impurezas: false, empaque: 'INTEGRO' });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) {
    assert.deepEqual(codigos(resultado), ['MISSING_PARAMETER']);
    assert.equal(resultado.issues[0]!.key, 'humedad');
  }
});

test('rechaza clave dinámica desconocida (PM-06)', () => {
  const resultado = validateInspectionParameters(harina, { ...valoresHarina, extra: 'x' });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(codigos(resultado), ['UNKNOWN_PARAMETER']);
});

test('rechaza booleano donde se espera DECIMAL (sin coerción)', () => {
  const resultado = validateInspectionParameters(harina, { ...valoresHarina, humedad: true });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(codigos(resultado), ['INVALID_TYPE']);
});

test('rechaza número donde se espera DECIMAL; exige string', () => {
  const resultado = validateInspectionParameters(harina, { ...valoresHarina, humedad: 16.5 });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(codigos(resultado), ['INVALID_TYPE']);
});

test('rechaza notación exponente en DECIMAL', () => {
  const resultado = validateInspectionParameters(harina, { ...valoresHarina, humedad: '1e3' });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(codigos(resultado), ['INVALID_DECIMAL']);
});

test('rechaza INF y NaN como valores dinámicos', () => {
  for (const humedad of [Number.POSITIVE_INFINITY, Number.NaN]) {
    const resultado = validateInspectionParameters(harina, { ...valoresHarina, humedad });
    assert.equal(resultado.ok, false);
  }
});

test('acepta límites inclusive y rechaza exceso por milésima', () => {
  const limite = validateInspectionParameters(harina, { ...valoresHarina, humedad: '100.000' });
  assert.equal(limite.ok, true);
  const exceso = validateInspectionParameters(harina, { ...valoresHarina, humedad: '100.001' });
  assert.equal(exceso.ok, false);
  if (!exceso.ok) assert.deepEqual(codigos(exceso), ['OUT_OF_RANGE']);
});

test('rechaza opción no incluida en la plantilla (SELECCION)', () => {
  const resultado = validateInspectionParameters(harina, { ...valoresHarina, color: 'ROJO' });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(codigos(resultado), ['INVALID_OPTION']);
});

test('rechaza string "true" donde se espera booleano', () => {
  const resultado = validateInspectionParameters(harina, { ...valoresHarina, impurezas: 'true' });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(codigos(resultado), ['INVALID_TYPE']);
});

test('ENTERO exige Int32 y respeta límites de la plantilla', () => {
  const base: Parameters = { peso: '150', piezas_danadas: 2, textura: 'BLANDA', empaque: 'INTEGRO' };
  assert.equal(validateInspectionParameters(galletas, base).ok, true);

  const negativo = validateInspectionParameters(galletas, { ...base, piezas_danadas: -1 });
  assert.equal(negativo.ok, false);
  if (!negativo.ok) assert.deepEqual(codigos(negativo), ['OUT_OF_RANGE']);

  const desbordado = validateInspectionParameters(galletas, { ...base, piezas_danadas: 2147483648 });
  assert.equal(desbordado.ok, false);
  if (!desbordado.ok) assert.deepEqual(codigos(desbordado), ['INVALID_TYPE']);
});

test('TEXTO respeta el máximo de 3000 caracteres', () => {
  const plantilla = [parametro('apariencia', 'TEXTO')];
  assert.equal(validateInspectionParameters(plantilla, { apariencia: 'a'.repeat(3000) }).ok, true);
  const resultado = validateInspectionParameters(plantilla, { apariencia: 'a'.repeat(3001) });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(codigos(resultado), ['INVALID_TYPE']);
});

test('DECIMAL admite hasta 34 dígitos significativos y rechaza 35', () => {
  const plantilla = [parametro('temperatura', 'DECIMAL')];
  assert.equal(validateInspectionParameters(plantilla, { temperatura: '0.1234567890123456789012345678901234' }).ok, true);
  const resultado = validateInspectionParameters(plantilla, { temperatura: '0.12345678901234567890123456789012345' });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(codigos(resultado), ['INVALID_DECIMAL']);
});

test('parámetro no requerido puede omitirse, pero no acepta null', () => {
  const plantilla = [parametro('color', 'SELECCION', ['BLANCO'], null, null, false)];
  assert.equal(validateInspectionParameters(plantilla, {}).ok, true);
  const resultado = validateInspectionParameters(plantilla, { color: null as unknown as string });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(codigos(resultado), ['INVALID_TYPE']);
});

test('acumula varios problemas en una sola respuesta', () => {
  const resultado = validateInspectionParameters(harina, { humedad: '16.5', color: 'ROJO', extra: 1 });
  assert.equal(resultado.ok, false);
  if (!resultado.ok) {
    assert.deepEqual(codigos(resultado), ['UNKNOWN_PARAMETER', 'INVALID_OPTION', 'MISSING_PARAMETER', 'MISSING_PARAMETER']);
  }
});

test('rechaza Parameters que no sea objeto', () => {
  const resultado = validateInspectionParameters(harina, null as unknown as Parameters);
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(codigos(resultado), ['INVALID_TYPE']);
});

test('la plantilla con SELECCION vacía o min>max es inválida', () => {
  assert.equal(validateTemplate([parametro('color', 'SELECCION', [])]).length, 1);
  assert.equal(validateTemplate([parametro('humedad', 'DECIMAL', [], '100', '0')]).length, 1);
  assert.equal(validateTemplate(harina).length, 0);
});

test('compareDecimals es exacto y no usa floating point', () => {
  assert.equal(compareDecimals('100.000', '100'), 0);
  assert.equal(compareDecimals('0.1', '0.2'), -1);
  assert.equal(compareDecimals('-1', '0'), -1);
  assert.equal(compareDecimals('-0', '0'), 0);
  assert.equal(compareDecimals('0.00000000000000000000000000001', '0'), 1);
  assert.equal(compareDecimals('999999999999999999.999', '1000000000000000000.000'), -1);
});
