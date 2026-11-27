CREATE CONSTRAINT proveedor_id_unique IF NOT EXISTS
FOR (n:Proveedor)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT producto_id_unique IF NOT EXISTS
FOR (n:Producto)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT lote_id_unique IF NOT EXISTS
FOR (n:Lote)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT proceso_id_unique IF NOT EXISTS
FOR (n:Proceso)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT distribucion_id_unique IF NOT EXISTS
FOR (n:Distribucion)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT ubicacion_id_unique IF NOT EXISTS
FOR (n:Ubicacion)
REQUIRE n.id IS UNIQUE;
