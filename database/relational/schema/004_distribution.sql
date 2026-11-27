-- TraceChain · 004 distribución. Fuente: DATA_MODEL.md §2 y RN-41..48.

CREATE TABLE distribuciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  ubicacion_origen_id UUID NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ubicacion_destino_id UUID NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  fecha_distribucion TIMESTAMPTZ NOT NULL,
  observaciones TEXT,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_distribucion_ubicaciones CHECK (ubicacion_origen_id <> ubicacion_destino_id)
);

CREATE TABLE detalle_distribuciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribucion_id UUID NOT NULL REFERENCES distribuciones(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  cantidad NUMERIC(18,3) NOT NULL CHECK (cantidad > 0),
  CONSTRAINT uq_detalle_distribucion_lote UNIQUE (distribucion_id, lote_id)
);

ALTER TABLE movimientos ADD COLUMN distribucion_id UUID
  REFERENCES distribuciones(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
