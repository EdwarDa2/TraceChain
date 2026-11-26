// Indices de la base documental tracechain_quality. Fuente: DATA_MODEL.md §3.
// Uso (cuando BASE-02 este disponible):
//   mongosh "mongodb://localhost:27017/tracechain_quality" --file database/document/indexes/create-indexes.mongosh.js
// No crear indices nuevos sin aprobacion (AI-04).

db.plantillas_inspeccion.createIndex({ codigo: 1, version: 1 }, { unique: true, name: "uq_codigo_version" });
db.plantillas_inspeccion.createIndex(
  { producto_id: 1 },
  { unique: true, partialFilterExpression: { activo: true }, name: "uq_producto_activo" }
);

db.inspecciones_calidad.createIndex({ codigo: 1 }, { unique: true, name: "uq_codigo" });
db.inspecciones_calidad.createIndex({ lote_id: 1, fecha_inspeccion: -1 }, { name: "idx_lote_fecha" });
db.inspecciones_calidad.createIndex(
  { producto_id: 1, resultado: 1, fecha_inspeccion: -1 },
  { name: "idx_producto_resultado_fecha" }
);
db.inspecciones_calidad.createIndex({ resultado: 1, fecha_inspeccion: -1 }, { name: "idx_resultado_fecha" });
db.inspecciones_calidad.createIndex({ "hallazgos.tipo": 1 }, { name: "idx_hallazgos_tipo" });
db.inspecciones_calidad.createIndex(
  { inspector_id: 1, idempotency_key: 1 },
  { unique: true, name: "uq_inspector_idempotency" }
);

db.expedientes_incidencias.createIndex({ incidencia_id: 1 }, { unique: true, name: "uq_incidencia" });
db.expedientes_incidencias.createIndex({ inspecciones_ids: 1 }, { name: "idx_inspecciones_ids" });
