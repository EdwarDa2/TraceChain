/**
 * Validación dinámica de parámetros de inspección contra la versión de plantilla.
 * Fuentes: DATA_MODEL.md §3, API_CONTRACT.md §2, RN-52/RN-55/RN-115, PM-05/PM-06.
 * Lógica pura: sin NestJS, sin driver de MongoDB y sin coercion de valores.
 * Los códigos `ValidationIssueCode` son internos; el endpoint mapea cualquier
 * fallo a INVALID_INSPECTION_PARAMETERS (422) según API_CONTRACT.md §6.
 */

export type DataType = 'TEXTO' | 'ENTERO' | 'DECIMAL' | 'BOOLEANO' | 'SELECCION';

export interface TemplateParameter {
  key: string;
  label: string;
  dataType: DataType;
  unit: string | null;
  required: boolean;
  options: string[];
  min: string | null;
  max: string | null;
}

export type ParameterValue = string | number | boolean;
export type Parameters = Record<string, ParameterValue>;

export type ValidationIssueCode =
  | 'INVALID_TEMPLATE'
  | 'MISSING_PARAMETER'
  | 'UNKNOWN_PARAMETER'
  | 'INVALID_TYPE'
  | 'INVALID_OPTION'
  | 'INVALID_DECIMAL'
  | 'OUT_OF_RANGE';

export interface ValidationIssue {
  code: ValidationIssueCode;
  key: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; values: Parameters }
  | { ok: false; issues: ValidationIssue[] };

const CLAVE = /^[a-z][a-z0-9_]*$/;
const DECIMAL = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const TIPOS: DataType[] = ['TEXTO', 'ENTERO', 'DECIMAL', 'BOOLEANO', 'SELECCION'];
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const MAX_PARAMETROS = 30;
const MAX_TEXTO = 3000;
const MAX_DIGITOS_DECIMAL = 34;

interface PartesDecimal {
  signo: bigint;
  entero: string;
  fraccion: string;
}

function partesDecimal(valor: string): PartesDecimal | null {
  if (!DECIMAL.test(valor)) return null;
  const cuerpo = valor.startsWith('-') ? valor.slice(1) : valor;
  const [entero, fraccion = ''] = cuerpo.split('.');
  return { signo: valor.startsWith('-') ? -1n : 1n, entero, fraccion };
}

function esCero(valor: string): boolean {
  const cuerpo = valor.replace('-', '').replace('.', '');
  return /^0+$/.test(cuerpo);
}

/** Comparación exacta de decimales sin usar floating point. */
export function compareDecimals(a: string, b: string): -1 | 0 | 1 {
  const pa = partesDecimal(a);
  const pb = partesDecimal(b);
  if (!pa || !pb) throw new Error('Decimal no canónico');
  if (esCero(a) && esCero(b)) return 0;
  if (pa.signo !== pb.signo) return pa.signo < pb.signo ? -1 : 1;

  const longitud = Math.max(pa.fraccion.length, pb.fraccion.length);
  const magnitudA = BigInt(pa.entero + pa.fraccion.padEnd(longitud, '0'));
  const magnitudB = BigInt(pb.entero + pb.fraccion.padEnd(longitud, '0'));
  const valorA = pa.signo * magnitudA;
  const valorB = pb.signo * magnitudB;
  return valorA < valorB ? -1 : valorA > valorB ? 1 : 0;
}

function digitosSignificativos(valor: string): number {
  const cuerpo = valor.replace('-', '').replace('.', '');
  return cuerpo.replace(/^0+/, '').length || 1;
}

function limiteComoTexto(valor: string | number | null): string | null {
  if (valor === null) return null;
  const texto = typeof valor === 'number' ? valor.toString() : valor;
  return DECIMAL.test(texto) ? texto : null;
}

function dentroDeLimites(texto: string, min: string | null, max: string | null): boolean {
  if (min !== null && compareDecimals(texto, min) < 0) return false;
  if (max !== null && compareDecimals(texto, max) > 0) return false;
  return true;
}

function problema(code: ValidationIssueCode, key: string, message: string): ValidationIssue {
  return { code, key, message };
}

/** Valida la definición de la plantilla antes de usar sus reglas. */
export function validateTemplate(plantilla: TemplateParameter[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(plantilla) || plantilla.length < 1 || plantilla.length > MAX_PARAMETROS) {
    return [problema('INVALID_TEMPLATE', '*', 'La plantilla debe tener entre 1 y 30 parámetros')];
  }

  const claves = new Set<string>();
  for (const parametro of plantilla) {
    if (!CLAVE.test(parametro.key) || claves.has(parametro.key)) {
      issues.push(problema('INVALID_TEMPLATE', parametro.key, 'Clave inválida o duplicada'));
    }
    claves.add(parametro.key);

    if (!TIPOS.includes(parametro.dataType)) {
      issues.push(problema('INVALID_TEMPLATE', parametro.key, 'dataType no oficial'));
      continue;
    }
    if (parametro.dataType === 'SELECCION') {
      if (!Array.isArray(parametro.options) || parametro.options.length === 0 ||
          new Set(parametro.options).size !== parametro.options.length) {
        issues.push(problema('INVALID_TEMPLATE', parametro.key, 'SELECCION requiere opciones no vacías y distintas'));
      }
    } else if (Array.isArray(parametro.options) && parametro.options.length > 0) {
      issues.push(problema('INVALID_TEMPLATE', parametro.key, 'Solo SELECCION admite options'));
    }

    const numerico = parametro.dataType === 'ENTERO' || parametro.dataType === 'DECIMAL';
    const min = limiteComoTexto(parametro.min);
    const max = limiteComoTexto(parametro.max);
    if (!numerico && (parametro.min !== null || parametro.max !== null)) {
      issues.push(problema('INVALID_TEMPLATE', parametro.key, 'min/max solo aplican a tipos numéricos'));
    } else if (numerico && ((parametro.min !== null && min === null) || (parametro.max !== null && max === null))) {
      issues.push(problema('INVALID_TEMPLATE', parametro.key, 'min/max no son decimales canónicos'));
    } else if (min !== null && max !== null && compareDecimals(min, max) > 0) {
      issues.push(problema('INVALID_TEMPLATE', parametro.key, 'min es mayor que max'));
    }
  }
  return issues;
}

/**
 * Valida los valores enviados en una inspección. No modifica ni coerciona valores:
 * los devuelve tal cual cuando todo es correcto (RN-52, RN-115).
 */
export function validateInspectionParameters(
  plantilla: TemplateParameter[],
  valores: Parameters,
): ValidationResult {
  const issues = validateTemplate(plantilla);
  if (issues.length > 0) return { ok: false, issues };

  if (valores === null || typeof valores !== 'object' || Array.isArray(valores)) {
    return { ok: false, issues: [problema('INVALID_TYPE', '*', 'Parameters debe ser un objeto')] };
  }

  const definiciones = new Map(plantilla.map((parametro) => [parametro.key, parametro]));
  for (const clave of Object.keys(valores)) {
    if (!definiciones.has(clave)) {
      issues.push(problema('UNKNOWN_PARAMETER', clave, 'Clave no definida en la plantilla'));
    }
  }

  for (const parametro of plantilla) {
    if (!(parametro.key in valores)) {
      if (parametro.required) {
        issues.push(problema('MISSING_PARAMETER', parametro.key, 'Parámetro requerido ausente'));
      }
      continue;
    }

    const valor = valores[parametro.key];
    const min = limiteComoTexto(parametro.min);
    const max = limiteComoTexto(parametro.max);

    switch (parametro.dataType) {
      case 'TEXTO':
        if (typeof valor !== 'string' || valor.length < 1 || valor.length > MAX_TEXTO) {
          issues.push(problema('INVALID_TYPE', parametro.key, 'TEXTO requiere una cadena de 1..3000 caracteres'));
        }
        break;
      case 'ENTERO': {
        if (typeof valor !== 'number' || !Number.isInteger(valor) ||
            valor < INT32_MIN || valor > INT32_MAX) {
          issues.push(problema('INVALID_TYPE', parametro.key, 'ENTERO requiere un Int32'));
          break;
        }
        const texto = valor.toString();
        if (!dentroDeLimites(texto, min, max)) {
          issues.push(problema('OUT_OF_RANGE', parametro.key, 'Valor ENTERO fuera de límites'));
        }
        break;
      }
      case 'DECIMAL':
        if (typeof valor !== 'string') {
          issues.push(problema('INVALID_TYPE', parametro.key, 'DECIMAL requiere una cadena, sin coerción'));
          break;
        }
        if (!DECIMAL.test(valor)) {
          issues.push(problema('INVALID_DECIMAL', parametro.key, 'DECIMAL requiere una cadena decimal canónica sin exponente'));
          break;
        }
        if (digitosSignificativos(valor) > MAX_DIGITOS_DECIMAL) {
          issues.push(problema('INVALID_DECIMAL', parametro.key, 'DECIMAL excede 34 dígitos significativos'));
          break;
        }
        if (!dentroDeLimites(valor, min, max)) {
          issues.push(problema('OUT_OF_RANGE', parametro.key, 'Valor DECIMAL fuera de límites'));
        }
        break;
      case 'BOOLEANO':
        if (typeof valor !== 'boolean') {
          issues.push(problema('INVALID_TYPE', parametro.key, 'BOOLEANO requiere un booleano'));
        }
        break;
      case 'SELECCION':
        if (typeof valor !== 'string') {
          issues.push(problema('INVALID_TYPE', parametro.key, 'SELECCION requiere una cadena'));
        } else if (!parametro.options.includes(valor)) {
          issues.push(problema('INVALID_OPTION', parametro.key, 'Valor fuera de las opciones de la plantilla'));
        }
        break;
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, values: valores };
}
