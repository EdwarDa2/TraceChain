import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateInspectionParameters,
  type TemplateParameter,
} from '../../../../backend/src/modules/inspections/parameters.validator.mts';
import { buildInspectionForm, formValuesToParameters } from './inspection-form.mts';

function parametro(
  key: string,
  dataType: TemplateParameter['dataType'],
  opciones: string[] = [],
  min: string | null = null,
  max: string | null = null,
): TemplateParameter {
  return { key, label: key.toUpperCase(), dataType, unit: null, required: true, options: opciones, min, max };
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
];

test('formulario de harina deriva tipos y opciones de la plantilla', () => {
  const campos = buildInspectionForm(harina);
  assert.deepEqual(campos.map((campo) => [campo.name, campo.type]), [
    ['humedad', 'decimal'],
    ['color', 'seleccion'],
    ['impurezas', 'booleano'],
    ['empaque', 'seleccion'],
  ]);
  assert.deepEqual(campos[1]!.options, ['BLANCO', 'CREMA', 'OTRO']);
  assert.equal(campos[0]!.min, '0.000');
  assert.equal(campos[0]!.max, '100.000');
  assert.equal(campos.every((campo) => campo.required), true);
});

test('formulario de galletas marca ENTERO y respeta copias de opciones', () => {
  const campos = buildInspectionForm(galletas);
  assert.equal(campos[1]!.type, 'entero');
  assert.equal(campos[1]!.min, '0');
  campos[2]!.options.push('OTRA');
  assert.deepEqual(galletas[2]!.options, ['CRUJIENTE', 'BLANDA', 'IRREGULAR']);
});

test('plantilla inválida no genera formulario', () => {
  assert.throws(() => buildInspectionForm([parametro('color', 'SELECCION', [])]), /Plantilla inválida/);
});

test('conversiones: ENTERO a número, DECIMAL a string, booleano intacto', () => {
  const parametros = formValuesToParameters({
    humedad: '16.5',
    color: 'BLANCO',
    impurezas: true,
    empaque: 'INTEGRO',
    ausente: null,
  }, harina);
  assert.deepEqual(parametros, {
    humedad: '16.5',
    color: 'BLANCO',
    impurezas: true,
    empaque: 'INTEGRO',
  });
});

test('valores convertidos de ENTERO pasan el validador de dominio', () => {
  const parametros = formValuesToParameters({
    peso: '150.000',
    piezas_danadas: '2',
    textura: 'BLANDA',
  }, galletas);
  assert.equal(typeof parametros.piezas_danadas, 'number');
  assert.equal(validateInspectionParameters(galletas, parametros).ok, true);
});

test('claves desconocidas no se filtran: el validador debe rechazarlas', () => {
  const parametros = formValuesToParameters({
    humedad: '16.5', color: 'BLANCO', impurezas: true, empaque: 'INTEGRO', extra: 'x',
  }, harina);
  const resultado = validateInspectionParameters(harina, parametros);
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.deepEqual(resultado.issues.map((i) => i.code), ['UNKNOWN_PARAMETER']);
});
