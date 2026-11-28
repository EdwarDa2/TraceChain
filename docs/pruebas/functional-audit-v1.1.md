# Auditoría funcional — TraceChain v1.1

Fecha: 2026-11-28. Alcance: siete documentos maestros (idénticos a los del ZIP adjunto, salvo `PROGRESS.md` actualizado), backend y frontend de `develop` tras PR #22, y la rama de cierre `fix/f5-closure`. Método: inspección de código + ejecución real con registros nuevos (`AUD-*`) sobre API real y los tres motores, con `OUTBOX_ENABLED=true` en una instancia aislada de auditoría (puerto 3002). No se borraron datos ni bases.

## 1. Separación de escenarios

| Escenario | Qué es | Dónde vive | No confundir con el producto |
|---|---|---|---|
| **Producto final operativo** | Alta dinámica de catálogos, recepciones, producción, distribución, inspecciones, incidencias, trazabilidad, impacto y dashboard sobre datos introducidos por usuarios | `backend/src/modules/**`, `frontend/src/**` | Es la aplicación; no depende de DEMO-150 |
| **Fixture canónico (9 lotes)** | Escenario de pruebas con UUID deterministas `00000000-0000-4000-8000-…`, reloj fijo y códigos PROV/PRD/UB definidos en `DATA_MODEL.md` §5 | `tests/integration/canonical-*.mts|mjs`, `tests/fixtures/` | Se usa solo en pruebas; no se carga en el arranque |
| **DEMO-150** | Escenario de demostración y validación funcional: 150 lotes, 60 órdenes, 40 distribuciones, 80 inspecciones, 10 incidencias; 279 nodos y 540 aristas | `tests/integration/demo150-seed.integration.mjs`, `scripts/seed-dev.mjs`, `tests/fixtures/demo/ampliada/` | Se carga con script independiente en entorno autorizado; **no es el producto** |
| **Escenarios experimentales** | QE-01..05, 100/1000/10000 lotes, profundidades 3/8/15 y topologías; comparación SQL/Cypher y latencia API | `tests/benchmark/**`, `docs/pruebas/benchmark-actual.*`, `benchmark-plans.json`, `api-latency-actual.*` | No sustituyen la operación normal ni a DEMO-150 |

## 2. Verificación funcional (producto final)

| Requisito de la auditoría | Resultado | Evidencia |
|---|---|---|
| Proveedores, productos y ubicaciones dinámicos | **Sí** | `POST /suppliers`, `/products`, `/locations` con códigos `AUD-*`; E2E crea proveedor desde la UI y lo consulta por filtro |
| Nuevas materias primas y lotes | **Sí** | `POST /lots/receipts` creó lote raíz de 50.000 KG con producto y proveedor nuevos |
| Producción consume insumos y genera lotes | **Sí** | `POST /production-orders` consumió 10.000 KG y generó lote terminado de 20.000 UNIDAD |
| Distribuciones dinámicas | **Sí** | `POST /distributions` transfirió 5.000 UNIDAD del lote nuevo a sucursal nueva |
| Inspecciones sobre lotes nuevos | **Sí** | `GET /inspection-templates/active` + `POST /inspections` sobre el lote generado |
| Incidencias desde registros reales | **Sí** | `POST /incidents` con lote raíz e inspección verificada; expediente `PENDIENTE` |
| Neo4j actualizado por eventos reales | **Sí (tras corrección)** | 36 eventos completados, 0 pendientes, 0 fallidos; `SYNCHRONIZED` |
| Trazabilidad con cualquier lote válido | **Sí** | `GET /traceability/:lot/forward?maxDepth=10` → `COMPLETO`, descendiente nuevo incluido |
| Impacto con cualquier incidencia válida | **Sí** | `GET /incidents/:id/impact` → `COMPLETO`, 2 lotes, 1 destino |
| Dashboard con datos reales de API | **Sí** | `/dashboard/summary` devolvió 40 lotes / 25 producciones / 2 incidencias tras las altas |
| Formularios, tablas, filtros y acciones conectados | **Sí** | E2E 20/20: alta de proveedor, búsqueda, 10 vistas, permisos y consulta de grafo |
| Sin IDs/cantidades/respuestas DEMO en app | **Sí** | Búsqueda de `DEMO`, `D01-`, `LOT-000`, `INC-DEMO`, `example.invalid`, UUID `00000000-0000-4000-8000-…` en `frontend/src` y `backend/src`: solo coincidencias en `*.spec.mts` (pruebas unitarias) |

Evidencia de la corrida: `docs/pruebas/audit-dynamic-actual.json`.

## 3. Hallazgos y correcciones

| ID | Hallazgo | Impacto | Corrección |
|---|---|---|---|
| A-01 | `createSupplier/createProduct/createLocation` insertaban en SQL pero **no escribían eventos al outbox**. Neo4j no conocía catálogos nuevos; el primer `LOTE_RECIBIDO` fallaba de forma permanente y bloqueaba toda la cola. | Bloqueaba la operación dinámica después de cargar DEMO | `backend/src/modules/queries/read.service.ts`: alta de catálogo + evento `PROVEEDOR_CREADO`/`PRODUCTO_CREADO`/`UBICACION_CREADA` en la misma transacción SQL, con payload que cumple `applyGraphEvent` |
| A-02 | `scripts/seed-dev.mjs` usa el generador experimental, que inserta códigos `OP-000…`/`DIST-000…` directamente sin avanzar `codigo_op_seq`/`codigo_dist_seq`. Tras cargar DEMO, `nextval` devolvía `OP-000004` contra un `OP-000021` existente. | Producción y distribución dinámicas fallaban por clave duplicada | `scripts/seed-dev.mjs`: `setval` de ambas secuencias al máximo numérico existente después de cargar el escenario |
| A-03 | El backend de desarrollo se ejecutaba con `OUTBOX_ENABLED=false`, por lo que no había proyección automática aunque el código del consumidor existe y `onModuleInit` la inicia con `true`. | Entorno, no código: hacía parecer que Neo4j no se actualizaba | Verificado con instancia de auditoría con `OUTBOX_ENABLED=true`; documentado en README |
| A-04 | El entorno de desarrollo no tenía validadores ni plantillas de inspección cargadas; `/inspection-templates/active` devolvía `TEMPLATE_UNAVAILABLE`. | Inspecciones dinámicas imposibles sin carga independiente | Cargados con `database/document/validators/apply-validators.mjs` y `database/document/data/seed-templates.mjs`; documentado en README como paso indispensable |
| A-05 | No se encontraron valores DEMO codificados en servicios de negocio ni en la UI. | Sin acción | Ninguna; los valores fijos están confinados a pruebas y scripts de carga |
| A-06 | Vitest intentó recolectar las specs de Playwright y fallaba en `npm run test`. | Rompía CI al añadir E2E | `frontend/vitest.config.ts` limita Vitest a `src/**/*.spec.mts` y excluye `e2e/**` |

No se modificaron contratos, modelos de datos, reglas de negocio ni algoritmos de grafos. La corrección A-01 usa el mismo writer de outbox y la misma transacción que las operaciones existentes.

## 4. Arranque sin DEMO

La aplicación arranca con `npm ci`, `db:up`, `db:migrate`, validadores y plantillas documentales. El cargador `scripts/seed-dev.mjs` es **independiente** y opcional: DEMO-150 no se importa desde `app.module.ts`, `main.ts`, controladores ni servicios. La auditoría ejecutó altas dinámicas sin cargar DEMO-150 en la base (los registros `AUD-*` son nuevos).

## 5. Pruebas ejecutadas

- `npm run typecheck`, `lint` y `build` de backend y frontend → exit 0; 14 rutas Next.js.
- `npm run test` → 2 archivos / 14 subtests OK.
- `npm run test:integration` → 3/3 motores, 2/2 outbox/idempotencia, 2/2 grafo/expediente, 1/1 outbox-runtime, 3/3 Jest.
- `npm run test:e2e` → **20/20** contra API real.
- Flujo dinámico `AUD-*` → 1/1 OK; trazabilidad e impacto sobre lotes nuevos; outbox 36/36 completos.
- Semilla DEMO-150 → 1/1 OK (evidencia previa, artefactos en `tests/fixtures/demo/ampliada/`).

## 6. Límites

- La aceptación humana de DA-01..08, la revisión de dueños I-1/I-2 y el release `v1.0.0` siguen pendientes.
- Los registros creados para la auditoría permanecen en la base aislada de desarrollo; no se eliminaron datos.
- No se declaró CI verde para la rama de cierre: el check `verify` del PR #23 estaba `in_progress` al consultar.
