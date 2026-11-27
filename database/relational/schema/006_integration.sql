-- TraceChain · 006 outbox e idempotencia. Fuente: DATA_MODEL.md §2, RN-101..120.

CREATE TABLE eventos_sincronizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secuencia BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  tipo_evento VARCHAR(60) NOT NULL,
  entidad_id UUID NOT NULL,
  tipo_entidad VARCHAR(40) NOT NULL,
  motor_destino VARCHAR(15) NOT NULL CHECK (motor_destino IN ('NEO4J', 'MONGODB')),
  payload JSONB NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'FALLIDO')),
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  ultimo_error TEXT,
  proximo_intento_at TIMESTAMPTZ,
  procesando_desde TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT ck_evento_completado CHECK (estado <> 'COMPLETADO' OR processed_at IS NOT NULL)
);

CREATE TABLE solicitudes_idempotentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave UUID NOT NULL,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  operacion VARCHAR(100) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response_status SMALLINT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_idempotencia UNIQUE (usuario_id, operacion, clave)
);
