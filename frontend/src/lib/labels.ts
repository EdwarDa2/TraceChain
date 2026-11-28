/** Traducciones visibles de códigos oficiales. El código original se conserva en `title`. */
const STATUS_LABELS: Record<string, string> = {
  FORWARD: 'Hacia adelante',
  BACKWARD: 'Hacia atrás',
  GENEALOGY: 'Genealogía',
  COMMON_ORIGINS: 'Orígenes comunes',
  PATHS: 'Caminos',
  COMPLETO: 'Completo',
  PARCIAL: 'Parcial',
  VACIO: 'Vacío',
  NO_DISPONIBLE: 'No disponible',
  ABIERTA: 'Abierta',
  EN_ANALISIS: 'En análisis',
  CERRADA: 'Cerrada',
  PENDIENTE: 'Pendiente',
  SINCRONIZADO: 'Sincronizado',
  DESACTIVADO: 'Desactivado',
  AVAILABLE: 'Disponible',
  DEGRADED: 'Degradado',
  UNAVAILABLE: 'No disponible',
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
  CONFORME: 'Conforme',
  NO_CONFORME: 'No conforme',
  MATERIA_PRIMA: 'Materia prima',
  INTERMEDIO: 'Intermedio',
  TERMINADO: 'Terminado',
  DISTRIBUCION_ENTRADA: 'Entrada por distribución',
  RECEPCION: 'Recepción',
  PRODUCCION: 'Producción',
  DISTRIBUCION: 'Distribución',
  INCIDENCIA: 'Incidencia',
  ERROR: 'Error',
  FALLIDO: 'Fallido',
  PROCESANDO: 'Procesando',
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

export function statusLabel(code: string): string {
  return STATUS_LABELS[code] ?? code.replaceAll('_', ' ');
}

export function catalogLabel(code: string, name: string, detail?: string | null): string {
  return [code, name, detail].filter(Boolean).join(' · ');
}
