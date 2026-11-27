-- TraceChain · 005 incidencias y bloqueos. Fuente: DATA_MODEL.md §2 y RN-59..68/87..96.

CREATE TABLE incidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  lote_origen_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  titulo VARCHAR(200) NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('CALIDAD', 'EMPAQUE', 'ALMACENAMIENTO', 'OTRO')),
  severidad VARCHAR(15) NOT NULL CHECK (severidad IN ('BAJA', 'MEDIA', 'ALTA')),
  estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'EN_ANALISIS', 'CERRADA')),
  estado_expediente VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_expediente IN ('PENDIENTE', 'SINCRONIZADO', 'ERROR')),
  reportado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  fecha_deteccion TIMESTAMPTZ NOT NULL,
  fecha_cierre TIMESTAMPTZ,
  cerrado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  resolucion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_incidencia_cierre CHECK (
    (estado = 'CERRADA' AND fecha_cierre IS NOT NULL AND cerrado_por IS NOT NULL AND resolucion IS NOT NULL) OR
    (estado <> 'CERRADA' AND fecha_cierre IS NULL AND cerrado_por IS NULL AND resolucion IS NULL)
  )
);

CREATE TABLE bloqueos_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  incidencia_id UUID NOT NULL REFERENCES incidencias(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  motivo TEXT NOT NULL,
  bloqueado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  fecha_bloqueo TIMESTAMPTZ NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  desbloqueado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  fecha_desbloqueo TIMESTAMPTZ,
  motivo_desbloqueo TEXT,
  CONSTRAINT ck_bloqueo_liberacion CHECK (
    (activo = true AND desbloqueado_por IS NULL AND fecha_desbloqueo IS NULL AND motivo_desbloqueo IS NULL) OR
    (activo = false AND desbloqueado_por IS NOT NULL AND fecha_desbloqueo IS NOT NULL AND motivo_desbloqueo IS NOT NULL)
  )
);
CREATE UNIQUE INDEX uq_bloqueos_activos ON bloqueos_lotes (lote_id, incidencia_id) WHERE activo;
