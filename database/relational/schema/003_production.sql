-- TraceChain · 003 producción. Fuente: DATA_MODEL.md §2 y RN-29..40.

CREATE TABLE ordenes_produccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  ubicacion_id UUID NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  fecha_produccion TIMESTAMPTZ NOT NULL,
  observaciones TEXT,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consumos_produccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_produccion_id UUID NOT NULL REFERENCES ordenes_produccion(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  cantidad NUMERIC(18,3) NOT NULL CHECK (cantidad > 0),
  CONSTRAINT uq_consumo_orden_lote UNIQUE (orden_produccion_id, lote_id)
);

CREATE TABLE resultados_produccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_produccion_id UUID NOT NULL REFERENCES ordenes_produccion(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  cantidad NUMERIC(18,3) NOT NULL CHECK (cantidad > 0),
  CONSTRAINT uq_resultado_lote UNIQUE (lote_id)
);

-- Las FK de movimientos a ordenes/distribuciones se añaden después de crear ambas tablas.
ALTER TABLE movimientos ADD COLUMN orden_produccion_id UUID
  REFERENCES ordenes_produccion(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
