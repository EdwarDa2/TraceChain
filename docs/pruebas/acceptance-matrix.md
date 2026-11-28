# Matriz de aceptación RF/RN → evidencia

Estado: consolidación F5 (2026-11-28). No sustituye la aceptación humana de DA-01..08. Las filas de `PROGRESS.md` §5/§6 son el registro histórico; esta matriz referencia la evidencia ejecutada sobre motores reales.

## Operaciones y catálogos (RF-01..15)

| RF | Evidencia |
|---|---|
| RF-01/02 | `tests/integration/read-api.integration.mjs` (auth 401/403, roles), `frontend/e2e/auth.spec.ts`, `frontend/e2e/permissions.spec.ts` |
| RF-03 | `docs/pruebas/demo150-actual.json` (dashboard 150/60/10/0), E2E dashboard y actividad real |
| RF-04/05/06 | `tests/integration/read-api.integration.mjs` (altas y duplicados), `tests/integration/operations-sql.integration.mts` |
| RF-07/08 | `tests/integration/operations-sql.integration.mts`, `tests/integration/operations-http.integration.mjs`, E2E inventario |
| RF-09/10 | `tests/integration/canonical-operations.integration.mjs`, `tests/integration/read-api.integration.mjs`, E2E búsqueda superior |
| RF-11/12/13 | `tests/integration/operations-sql.integration.mts` (multientrada, multinivel, rollback), E2E producción |
| RF-14/15 | `tests/integration/operations-http.integration.mjs`, E2E distribución, `docs/pruebas/demo150-actual.json` |

## Calidad, incidencias y bloqueos (RF-16..23, RF-31/32)

| RF | Evidencia |
|---|---|
| RF-16/17/18 | `tests/integration/engines-smoke.mjs`, `tests/integration/demo150-seed.integration.mjs` (80 inspecciones, plantillas activas), E2E inspecciones |
| RF-19 | `tests/integration/demo150-seed.integration.mjs` (40/80 no conformes y hallazgos APARIENCIA/MEDIA), agregaciones de calidad |
| RF-20/21/22/23 | `tests/integration/demo150-seed.integration.mjs` (10 incidencias/expedientes, CAS y transición), `tests/integration/dossier-projection.integration.mts`, E2E incidencias |
| RF-31/32 | `tests/integration/demo150-seed.integration.mjs` (bloqueo manual, rechazo de distribución, cierre sin liberar y retiro individual) |

## Trazabilidad, impacto y sincronización (RF-24..30, RF-33..35)

| RF | Evidencia |
|---|---|
| RF-24/25/26/27 | `tests/integration/canonical-graph.integration.mts`, `tests/integration/graph-verification.integration.mts`, `docs/pruebas/matriz-trazabilidad.md`, E2E trazabilidad |
| RF-28 | `frontend/e2e/traceability.spec.ts` (grafo + alternativa textual), `frontend/DESIGN.md` |
| RF-29/30 | `tests/integration/demo150-seed.integration.mjs` (13 lotes, 4 destinos, stock sin doble conteo), E2E impacto vía enlace de incidencia |
| RF-33 | `tests/integration/outbox.integration.mts`, `tests/integration/outbox-runtime.integration.mjs`, `docs/pruebas/concurrency-recovery-actual.json` |
| RF-34 | `tests/integration/dossier-projection.integration.mts`, `tests/integration/demo150-seed.integration.mjs` |
| RF-35 | `docs/pruebas/demo150-actual.json` (sin pendientes/fallos), dashboard de estado, DA-07 PARCIAL |

## Casos DA y benchmark

| Caso | Evidencia |
|---|---|
| DA-01 | `tests/fixtures/demo/ampliada/manifest.json`, `expected-results.json`, `docs/pruebas/demo150-actual.json` |
| DA-02..07 | `tests/integration/demo150-seed.integration.mjs` (1/1 OK), `expected-results.json`; UI cubierta por suite E2E |
| DA-08 | `docs/pruebas/benchmark-actual.json`, `benchmark-plans.json`, `api-latency-actual.json` (9 perfiles, 2 700 mediciones, 45/45 equivalencias) |

## Pendiente para aceptación

- Revisión humana de los resultados por los tres integrantes, con dueños de módulo para I-1/I-2.
- Ejecución de la semilla sobre un entorno reproducido desde cero con los UUID del manifiesto y verificación contra el oráculo (la corrida registrada usó esquema/DB temporales).
- Ratificación de D-001/D-002 y cierre de B-001/002/003 en `PROGRESS.md`.
- Release `develop → main` y tag `v1.0.0` solo tras aceptación.
