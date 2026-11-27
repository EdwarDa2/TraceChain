CREATE INDEX proveedor_codigo_index IF NOT EXISTS
FOR (n:Proveedor)
ON (n.codigo);

CREATE INDEX producto_codigo_index IF NOT EXISTS
FOR (n:Producto)
ON (n.codigo);

CREATE INDEX lote_codigo_index IF NOT EXISTS
FOR (n:Lote)
ON (n.codigo);

CREATE INDEX proceso_codigo_index IF NOT EXISTS
FOR (n:Proceso)
ON (n.codigo);

CREATE INDEX distribucion_codigo_index IF NOT EXISTS
FOR (n:Distribucion)
ON (n.codigo);

CREATE INDEX ubicacion_codigo_index IF NOT EXISTS
FOR (n:Ubicacion)
ON (n.codigo);
