# Capa documental de TraceChain (I-2)

Artefactos de las colecciones oficiales de `tracechain_quality`. Fuentes: `DATA_MODEL.md` §3, `API_CONTRACT.md` §2, `BUSINESS_RULES.md`, `AGENTS.md`. Dueño: I-2 (`database/document/**`).

**No hay colecciones nuevas, parámetros nuevos ni límites sanitarios.** Las decisiones de validación dinámica por plantilla y la regla «NO_CONFORME exige hallazgo» se aplican en el servicio NestJS, no se inventan en el esquema (RN-56, RN-115).

## Archivos

| Archivo | Función |
|---|---|
| `validators/plantillas-inspeccion.schema.json` | `$jsonSchema` de E-14 (plantillas versionadas) |
| `validators/inspecciones-calidad.schema.json` | `$jsonSchema` de E-13 (inspecciones inmutables) |
| `validators/expedientes-incidencias.schema.json` | `$jsonSchema` de E-16 (expedientes) |
| `validators/apply-validators.mjs` | Aplica los tres validadores con `createCollection`/`collMod`, strict/error |
| `indexes/create-indexes.mongosh.js` | Los 10 índices declarados en `DATA_MODEL.md` §3 |
| `data/plantillas-inspeccion.json` | Las seis plantillas v1 con UUID deterministas de fixture |
| `data/seed-templates.mjs` | Carga idempotente con `$setOnInsert` (`Decimal128`/`Int32`) |
| `tests/static-check.mjs` | Verificación estructural sin motor ni dependencias |

## Requisitos previos

- BASE-01: workspaces y dependencias del stack (`mongodb` 6.x, sin ORM).
- BASE-02: MongoDB aislado y `MONGODB_URI`. Nombre de base por defecto `tracechain_quality`.
- BASE-05: contratos compartidos, para los módulos NestJS que consumirán estos artefactos.

## Orden de ejecución (cuando exista infraestructura)

```bash
node database/document/tests/static-check.mjs
mongosh "mongodb://localhost:27017/tracechain_quality" --file database/document/indexes/create-indexes.mongosh.js
MONGODB_URI=<uri> node database/document/validators/apply-validators.mjs
MONGODB_URI=<uri> node database/document/data/seed-templates.mjs
```

No usar URI con credenciales reales en comandos versionados: tomarla del entorno (RN-07, AI-16). Los scripts son repetibles: no borran colecciones ni sobrescriben plantillas existentes; ante un cambio de versión se crea una versión nueva (AI-09, RN-54).

## Estado de verificación

- `node database/document/tests/static-check.mjs`: **OK, 309 verificaciones** (2026-11-26). Comprueba esquemas, campos requeridos, seis plantillas, parámetros, opciones, UUID, índices, strict/error, inmutabilidad del seed y ausencia de secretos.
- PM-01..23: **NOT_RUN**; requieren MongoDB real. Este chequeo estático no sustituye a las pruebas del motor ni a `test:integration`.
- Lint, typecheck y build: **NOT_RUN**; no hay `package.json` funcional ni dependencias instaladas hasta BASE-01.

DOC-01 y DOC-02 permanecen `PENDING` en `PROGRESS.md` hasta aplicar estos artefactos sobre MongoDB y ejecutar PM-01/02/07/11/12/23. Los módulos TypeScript (`inspection-templates`, `inspections`, `quality`, `incidents`, `lot-blocks`) no se escriben aún: sus firmas dependen de `packages/contracts` (BASE-05) y escribirlas ahora obligaría a rehacerlas.
