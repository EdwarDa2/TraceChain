-- TraceChain · 007 índices y vistas. Fuente: DATA_MODEL.md §2.

CREATE INDEX idx_lotes_producto ON lotes (producto_id);
CREATE INDEX idx_lotes_proveedor ON lotes (proveedor_id);
CREATE INDEX idx_lotes_caducidad ON lotes (fecha_caducidad);
CREATE INDEX idx_existencias_ubicacion_lote ON existencias (ubicacion_id, lote_id);
CREATE INDEX idx_movimientos_lote_fecha ON movimientos (lote_id, fecha_movimiento DESC);
CREATE INDEX idx_movimientos_orden ON movimientos (orden_produccion_id);
CREATE INDEX idx_movimientos_distribucion ON movimientos (distribucion_id);
CREATE INDEX idx_ordenes_fecha ON ordenes_produccion (fecha_produccion DESC);
CREATE INDEX idx_consumos_lote_orden ON consumos_produccion (lote_id, orden_produccion_id);
CREATE INDEX idx_resultados_orden ON resultados_produccion (orden_produccion_id);
CREATE INDEX idx_distribuciones_destino_fecha ON distribuciones (ubicacion_destino_id, fecha_distribucion);
CREATE INDEX idx_distribuciones_origen_fecha ON distribuciones (ubicacion_origen_id, fecha_distribucion);
CREATE INDEX idx_detalle_lote ON detalle_distribuciones (lote_id);
CREATE INDEX idx_incidencias_estado_fecha ON incidencias (estado, fecha_deteccion DESC);
CREATE INDEX idx_incidencias_lote ON incidencias (lote_origen_id);
CREATE INDEX idx_bloqueos_lote ON bloqueos_lotes (lote_id) WHERE activo;
CREATE INDEX idx_bloqueos_incidencia ON bloqueos_lotes (incidencia_id);
CREATE INDEX idx_eventos_pendientes ON eventos_sincronizacion (motor_destino, secuencia) WHERE estado <> 'COMPLETADO';

CREATE OR REPLACE VIEW v_inventario AS
SELECT
  e.lote_id, l.producto_id, e.ubicacion_id, e.cantidad AS cantidad_fisica,
  CASE WHEN EXISTS (SELECT 1 FROM bloqueos_lotes b WHERE b.lote_id = e.lote_id AND b.activo)
       OR (l.fecha_caducidad IS NOT NULL AND l.fecha_caducidad < CURRENT_DATE)
       THEN 0 ELSE e.cantidad END AS cantidad_utilizable,
  p.unidad_medida,
  EXISTS (SELECT 1 FROM bloqueos_lotes b WHERE b.lote_id = e.lote_id AND b.activo) AS bloqueado,
  (l.fecha_caducidad IS NOT NULL AND l.fecha_caducidad < CURRENT_DATE) AS caducado
FROM existencias e
JOIN lotes l ON l.id = e.lote_id
JOIN productos p ON p.id = l.producto_id
JOIN ubicaciones u ON u.id = e.ubicacion_id;

CREATE OR REPLACE VIEW v_estado_lotes AS
SELECT
  l.id AS lote_id,
  COALESCE(SUM(e.cantidad), 0) AS total_fisico,
  COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM bloqueos_lotes b WHERE b.lote_id = e.lote_id AND b.activo)
                      OR (l.fecha_caducidad IS NOT NULL AND l.fecha_caducidad < CURRENT_DATE)
                    THEN 0 ELSE e.cantidad END), 0) AS total_utilizable,
  (SELECT COUNT(*) FROM bloqueos_lotes b WHERE b.lote_id = l.id AND b.activo) AS bloqueos_activos,
  (l.fecha_caducidad IS NOT NULL AND l.fecha_caducidad < CURRENT_DATE) AS caducado,
  (COALESCE(SUM(e.cantidad), 0) = 0) AS agotado
FROM lotes l
LEFT JOIN existencias e ON e.lote_id = l.id
GROUP BY l.id;

CREATE OR REPLACE VIEW v_dependencias_productivas AS
SELECT
  c.lote_id AS lote_padre_id,
  c.orden_produccion_id,
  r.lote_id AS lote_hijo_id,
  c.id AS consumo_id,
  r.id AS resultado_id
FROM consumos_produccion c
JOIN resultados_produccion r ON r.orden_produccion_id = c.orden_produccion_id;
