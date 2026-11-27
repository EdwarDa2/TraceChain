/**
 * Modelo de vista de incidencias y bloqueos (DOC-09).
 * Fuentes: RF-20..23/31/32, RN-11/87/96/117, API_CONTRACT.md §3, RNF-15/16.
 * La autorización efectiva se valida en backend; aquí solo se ocultan acciones
 * para que la UI no ofrezca operaciones prohibidas (RN-11).
 */

import type { IncidentStatus, SyncStatus } from '../../../../backend/src/modules/incidents/incident-lifecycle.mts';

export type Role = 'OPERADOR' | 'ANALISTA_CALIDAD';
export type AccionIncidente =
  | 'VER_IMPACTO'
  | 'EDITAR_EXPEDIENTE'
  | 'INICIAR_ANALISIS'
  | 'CERRAR'
  | 'BLOQUEAR'
  | 'LIBERAR';

export interface VistaIncidente {
  status: IncidentStatus;
  dossierStatus: SyncStatus;
  tieneBloqueosActivos: boolean;
}

const ETIQUETAS: Record<IncidentStatus, string> = {
  ABIERTA: 'Abierta',
  EN_ANALISIS: 'En análisis',
  CERRADA: 'Cerrada',
};

const ETIQUETAS_SYNC: Record<SyncStatus, string> = {
  PENDIENTE: 'Expediente pendiente',
  SINCRONIZADO: 'Expediente sincronizado',
  ERROR: 'Expediente con error',
};

export function etiquetaEstado(status: IncidentStatus): string {
  return ETIQUETAS[status];
}

export function etiquetaSincronizacion(status: SyncStatus): string {
  return ETIQUETAS_SYNC[status];
}

/** Acciones visibles por rol y estado; no sustituye la autorización del backend. */
export function accionesPermitidas(vista: VistaIncidente, rol: Role): AccionIncidente[] {
  const acciones: AccionIncidente[] = ['VER_IMPACTO'];
  if (rol !== 'ANALISTA_CALIDAD') return acciones;

  if (vista.status === 'ABIERTA') {
    acciones.push('EDITAR_EXPEDIENTE', 'INICIAR_ANALISIS');
    return acciones;
  }
  if (vista.status === 'EN_ANALISIS') {
    if (vista.dossierStatus === 'SINCRONIZADO') acciones.push('CERRAR');
    else acciones.push('EDITAR_EXPEDIENTE');
    acciones.push('BLOQUEAR');
  }
  // El cierre no libera bloqueos: liberar sigue disponible aun en CERRADA (RN-96).
  if (vista.tieneBloqueosActivos) acciones.push('LIBERAR');
  return acciones;
}

/** Mutaciones irreversibles o con efecto sobre stock/productivo requieren confirmación. */
export function requiereConfirmacion(accion: AccionIncidente): boolean {
  return ['CERRAR', 'BLOQUEAR', 'LIBERAR'].includes(accion);
}
