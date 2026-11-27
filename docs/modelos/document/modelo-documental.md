# Modelo documental — resumen derivado (no normativo)

Fuente normativa: `DATA_MODEL.md` §3 y `API_CONTRACT.md` §2. Base `tracechain_quality`, instancia única, driver `mongodb` 6.x ≥6.10. **No hay colecciones nuevas** más allá de las tres oficiales (AI-04).

## Colecciones

| Entidad | Colección | Índices relevantes |
|---|---|---|
| E-14 | `plantillas_inspeccion` | `UQ(codigo,version)`, `UQ(producto_id)` parcial `activo=true`, `_id` |
| E-13 | `inspecciones_calidad` | `UQ(codigo)`, `(lote_id,fecha_inspeccion DESC)`, `(producto_id,resultado,fecha DESC)`, `(resultado,fecha DESC)`, `hallazgos.tipo`, `UQ(inspector_id,idempotency_key)` |
| E-16 | `expedientes_incidencias` | `UQ(incidencia_id)`, `inspecciones_ids` multikey, `_id` |

`_id` es UUID v4 en string; fechas BSON Date UTC; versiones y enteros Int32; decimales Decimal128 finitos convertidos desde/d hacia string en la API. Validadores `$jsonSchema` con `strict/error` y `additionalProperties:false` en documentos y subdocumentos fijos; `parametros` permite claves dinámicas autorizadas por plantilla.

## Límites y reglas

Hasta 30 parámetros, 30 hallazgos, 20 evidencias, 50 inspecciones referenciadas por expediente; textos dinámicos ≤3000, descripciones ≤5000, notas ≤3000, referencias ≤500. Inspecciones inmutables; no conforme exige al menos un hallazgo (decisión del analista, RN-56). Expedientes escritos solo por handler, con `expectedVersion` y CAS por versión (RN-116). El cierre y el estado oficial viven en PostgreSQL, no en Mongo.

Seis plantillas v1: TPL-HARINA, TPL-AZUCAR, TPL-MASA, TPL-PAN, TPL-GALLETAS y TPL-GENERAL (fallback). Todas sus versiones son inmutables; solo el flag `activo` cambia por migración controlada.

## Artefactos de I-2

Los validadores, índices, semilla y scripts de aplicación están en `database/document/**` y se describen en su `README.md`. La verificación estática (`node database/document/tests/static-check.mjs`) pasó con 309 comprobaciones. Las pruebas PM-01..23 requieren MongoDB real y siguen `NOT_RUN`.
