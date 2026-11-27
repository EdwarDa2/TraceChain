/**
 * Modelo de vista del formulario dinámico de inspecciones (DOC-08).
 * Fuentes: RF-16/RF-17, DATA_MODEL.md §3, API_CONTRACT.md §2, RN-51..54/115.
 * Los tipos se importan del validador de I-2; al existir BASE-05 se trasladarán
 * a packages/contracts. Sin React, sin Zod y sin dependencias nuevas.
 */

import {
  validateTemplate,
  type Parameters,
  type TemplateParameter,
} from '../../../../backend/src/modules/inspections/parameters.validator.mts';

export type FormFieldType = 'texto' | 'entero' | 'decimal' | 'booleano' | 'seleccion';

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  unit: string | null;
  options: string[];
  min: string | null;
  max: string | null;
}

const TIPO_FORMULARIO: Record<TemplateParameter['dataType'], FormFieldType> = {
  TEXTO: 'texto',
  ENTERO: 'entero',
  DECIMAL: 'decimal',
  BOOLEANO: 'booleano',
  SELECCION: 'seleccion',
};

/** Descriptor de campos para React Hook Form; la plantilla válida es la fuente única. */
export function buildInspectionForm(template: TemplateParameter[]): FormField[] {
  const problemas = validateTemplate(template);
  if (problemas.length > 0) {
    throw new Error(`Plantilla inválida: ${problemas.map((p) => `${p.key}:${p.code}`).join(', ')}`);
  }
  return template.map((parametro) => ({
    name: parametro.key,
    label: parametro.label,
    type: TIPO_FORMULARIO[parametro.dataType],
    required: parametro.required,
    unit: parametro.unit,
    options: [...parametro.options],
    min: parametro.min,
    max: parametro.max,
  }));
}

/** Valores del formulario (strings/boolean) → valores del contrato (Int32, string, bool). */
export function formValuesToParameters(
  valores: Record<string, string | boolean | null | undefined>,
  template: TemplateParameter[],
): Parameters {
  const tipos = new Map(template.map((parametro) => [parametro.key, parametro.dataType]));
  const resultado: Parameters = {};

  for (const [clave, valor] of Object.entries(valores)) {
    if (valor === null || valor === undefined) continue;
    const tipo = tipos.get(clave);
    if (tipo === 'ENTERO' && typeof valor === 'string' && /^-?[0-9]+$/.test(valor)) {
      resultado[clave] = Number(valor);
      continue;
    }
    resultado[clave] = valor;
  }
  return resultado;
}
