-- TraceChain · 002 lotes, existencias y movimientos. Fuente: DATA_MODEL.md §2.

CREATE TABLE lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  codigo_lote_proveedor VARCHAR(100),
  tipo_origen VARCHAR(20) NOT NULL CHECK (tipo_origen IN ('RECEPCION', 'PRODUCCION')),
  cantidad_inicial NUMERIC(18,3) NOT NULL CHECK (cantidad_inicial > 0),
  fecha_origen TIMESTAMPTZ NOT NULL,
  fecha_caducidad DATE,
  registrado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_lote_origen CHECK (
    (tipo_origen = 'RECEPCION' AND proveedor_id IS NOT NULL) OR
    (tipo_origen = 'PRODUCCION' AND proveedor_id IS NULL AND codigo_lote_proveedor IS NULL)
  )
);

CREATE TABLE existencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ubicacion_id UUID NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  cantidad NUMERIC(18,3) NOT NULL CHECK (cantidad >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_existencia_lote_ubicacion UNIQUE (lote_id, ubicacion_id)
);

CREATE TABLE movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ubicacion_id UUID NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  tipo VARCHAR(35) NOT NULL CHECK (tipo IN (
    'RECEPCION', 'CONSUMO_PRODUCCION', 'RESULTADO_PRODUCCION',
    'DISTRIBUCION_SALIDA', 'DISTRIBUCION_ENTRADA'
  )),
  sentido VARCHAR(10) NOT NULL CHECK (sentido IN ('ENTRADA', 'SALIDA')),
  cantidad NUMERIC(18,3) NOT NULL CHECK (cantidad > 0),
  cantidad_anterior NUMERIC(18,3) NOT NULL CHECK (cantidad_anterior >= 0),
  cantidad_posterior NUMERIC(18,3) NOT NULL CHECK (cantidad_posterior >= 0),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  fecha_movimiento TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_saldo_movimiento CHECK (
    (sentido = 'ENTRADA' AND cantidad_posterior = cantidad_anterior + cantidad) OR
    (sentido = 'SALIDA' AND cantidad_posterior = cantidad_anterior - cantidad)
  )
);
