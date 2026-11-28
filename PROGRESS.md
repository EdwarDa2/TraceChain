# PROGRESS.md — punto de control vivo (línea base v1.1)

**Fecha de inicialización:** 2026-11-25. **Fase:** F0 preparación. **Estado de implementación:** no verificado; ningún módulo se considera implementado por esta documentación. **Rama/commit:** no inspeccionados. **Pruebas:** ninguna ejecutada en la creación de los documentos. Antes de comenzar, contrastar este punto de control con el repositorio real y actualizar solo con evidencia.

Este archivo no cambia alcance ni contratos. Leerlo junto con AGENTS.md, PROJECT.md, REQUIREMENTS.md, BUSINESS_RULES.md, DATA_MODEL.md y API_CONTRACT.md. Git/CI/Issue y código son evidencia de estado; los otros seis documentos son la especificación. Cada integrante modifica su propia sección y agrega sesiones; los cambios compartidos requieren coordinación. No borrar historia; resolver conflictos conservando entradas de todos.

## 1. Estados y métricas
PENDING (no iniciada), READY (sin dependencias conocidas pendientes y autorizada para iniciar), IN_PROGRESS (en curso), BLOCKED (impedimento concreto), IMPLEMENTED (código escrito, aún no verificado), TESTING (verificación en curso), VERIFIED (criterios/pruebas comprobados), MERGED (PR integrado en develop con evidencia). NOT_RUN solo para pruebas no ejecutadas. Si se detecta regresión, devolver tarea a IN_PROGRESS/TESTING y registrar motivo sin borrar verificación histórica. MERGED no garantiza ausencia de regresiones futuras.

Progreso de desarrollo = tareas base MERGED / total tareas base de tabla §3 * 100; progreso de verificación = (VERIFIED + MERGED vigentes) / total * 100. Métricas por integrante usan únicamente tareas de su propiedad; Equipo se cuenta una vez en total, no tres. Si se añaden tareas aprobadas, registrar nuevo denominador/fecha y motivo; no estimar porcentajes por cantidad de código. Inicial: 0 tareas verificadas, 0 integradas; no afirmar estado de repositorio sin inspección. Documentación de planificación preparada, no es avance de código.

## 2. Hitos
| Hito | Estado inicial | Criterio de salida | Evidencia |
|---|---|---|---|
| F0 Bootstrap | READY | Repositorio, motores, apps y contratos base verificables | — |
| F1 Persistencia | PENDING | Esquemas/validadores/restricciones y semillas | — |
| F2 Funciones base | PENDING | Recepción/producción, inspección, sincronización y recorridos | — |
| F3 Integración | PENDING | Distribución, incidencias, bloqueos, impacto y caminos | — |
| F4 UI | MERGED | 14 vistas con API real | PR #22 fusionado en `develop` (`4105962`), CI `verify` success 2026-11-28T03:25Z |
| F5 Entrega | PENDING | Tests, demo ampliada DA-01..08, benchmark, documentación, release | — |

## 3. Backlog base (IDs locales; vincular Issue real cuando exista)
Cada fila tiene un resultado verificable. Estado READY inicial solo para tareas de bootstrap/documentación que no necesitan código previo; confirmar repo real antes de iniciar. Los demás PENDING hasta dependencia satisfecha. Si un contrato permite mock, registrar explícitamente qué parte se verifica aislada; no marcar integración como completada. Los RF se detallan en REQUIREMENTS; dependencias indican tareas mínimas, no autorización para alterar módulos. Evidencia se registra en sesión y PR, no inventar IDs de GitHub.

| ID | Fase | Dueño | Tarea y criterio de aceptación | Depende de | Estado | Evidencia/PR |
|---|---|---|---|---|---|---|
| BASE-01 | F0 | I-1 | Inicializar workspaces, NestJS, scripts, CI y git; npm ci/build base | — | READY | — |
| BASE-02 | F0 | I-1 | Docker y configuración; motores aislados y health degradado | BASE-01 | PENDING | — |
| BASE-03 | F0 | I-2 | Incorporar siete documentos, revisar especificación con equipo, crear Issues | — | READY | — |
| BASE-04 | F0 | I-3 | Inicializar Next.js, layouts, componentes y guía visual accesible | BASE-01 | MERGED | PR #22 en `develop` (`4105962`); Lighthouse accesibilidad 1.00, responsive 1440/768/390 y E2E 19/19 — TC-SESSION-20261127-I3-034/035 |
| BASE-05 | F0 | Equipo | Tipos compartidos, interfaces DI, eventos y DTO, compile check | BASE-01, BASE-03 | PENDING | — |
| BASE-06 | F0 | Equipo | Fixtures UUID, reloj, harness y resultados esperados comunes | BASE-05 | PENDING | — |
| REL-01 | F1 | I-1 | Migraciones 16 tablas + registro, constraints, índices y vistas | BASE-02, BASE-05 | PENDING | — |
| REL-02 | F1 | I-1 | Lectores de lote/producto/stock/incident/blocks y Tx compartida | REL-01 | PENDING | — |
| REL-03 | F1 | I-1 | Repositorios SQL incidencia/bloqueo + locks y versión confirmada | REL-02 | PENDING | — |
| DOC-01 | F1 | I-2 | 3 colecciones strict/error e índices; PM-07/12 | BASE-02, BASE-05 | PENDING | — |
| DOC-02 | F1 | I-2 | 6 plantillas v1 y selección/historial; PM-01/02/11 | DOC-01, BASE-06 | PENDING | — |
| GRA-01 | F1 | I-3 | 6 etiquetas/7 relaciones constraints e índices | BASE-02, BASE-05 | MERGED | PR #9 → `develop` (`b0e6894`); Neo4j real 4/4 estáticas y 2/2 integración |
| REL-04 | F2 | I-1 | Auth, roles y throttling; PS-01..12 aplicables | REL-01 | PENDING | — |
| REL-05 | F2 | I-1 | Catálogos completos; reactivación y restricciones históricas | REL-02, REL-04 | PENDING | — |
| REL-06 | F2 | I-1 | Outbox, idempotencia, locks y retry; pruebas recuperación | REL-01, BASE-05 | IN_PROGRESS | PR #10 y #11 fusionados en `develop` (`11ca103`); integración parcial, falta aceptación operativa/API |
| REL-07 | F2 | I-1 | Recepciones, stock y movimientos; TP-03..05 | REL-05, REL-06 | PENDING | — |
| REL-08 | F2 | I-1 | Producción atómica y concurrencia; TP-06..11/16/23 | REL-07 | PENDING | — |
| DOC-03 | F2 | I-2 | Validación dinámica, inspecciones inmutables e idempotencia; PM-03..10/23 | DOC-02, REL-02, REL-04 | PENDING | — |
| DOC-04 | F2 | I-2 | Consultas, agregaciones y QualityReader; PM-17/18 | DOC-03 | PENDING | — |
| GRA-02 | F2 | I-3 | Handlers catálogo/recepción/producción idempotentes; PG-01..04 | GRA-01, REL-06 | IN_PROGRESS | PR #11 fusionado (`11ca103`); PG-01..04 probadas con eventos controlados en Neo4j; falta extremo a extremo SQL/API |
| GRA-03 | F2 | I-3 | BFS adelante/atrás/genealogía, niveles y advertencias; PG-05..07/13 | GRA-02, REL-08 | PENDING | — |
| REL-09 | F3 | I-1 | Distribución transaccional y movimientos; TP-12/13 | REL-08 | PENDING | — |
| REL-10 | F3 | I-1 | Dashboard API, actividad, estado sync; conteos fixture | REL-03, REL-09 | PENDING | — |
| DOC-05 | F3 | I-2 | Dossier repositorio, CAS, handlers Mongo; PM-12..16 | DOC-04, REL-03, REL-06 | PENDING | — |
| DOC-06 | F3 | I-2 | Incidencias crear/consultar/actualizar/iniciar/cerrar; PM-19..22 | DOC-05, GRA-03 | PENDING | — |
| GRA-04 | F3 | I-3 | Distribución proyectada y destinos históricos; PG-11 | GRA-02, REL-09 | BLOCKED | Proyección/destinos con eventos controlados en `feature/graph-traversals`; REL-09 SQL/API real pendiente |
| GRA-05 | F3 | I-3 | Comunes/caminos, caps, verificación descendiente; PG-08..10/21 | GRA-03 | PENDING | — |
| DOC-07 | F3 | I-2 | Bloquear/liberar con SQL y verificación grafo; TP-17/PI-08 | DOC-06, GRA-05, REL-03 | PENDING | — |
| GRA-06 | F3 | I-3 | Impacto integrado y mapeo visual; PI-07/10 | GRA-04, GRA-05, DOC-05, DOC-06, REL-02 | PENDING | — |
| REL-11 | F3 | I-1 | Detalle lote integrado QI-01; PI-09 | DOC-04, GRA-03, REL-02 | PENDING | — |
| REL-12 | F4 | I-1 | 8 vistas/secciones operativas, login, inventario/producción/distribución | REL-11, REL-09, BASE-04 | MERGED | PR #22 (`4105962`) con CI verde; E2E cubre las 10 rutas navegables — TC-SESSION-20261128-I3-035 |
| DOC-08 | F4 | I-2 | UI inspecciones, formulario dinámico, detalle, indicadores | DOC-04, BASE-04 | MERGED | PR #22 (`4105962`) con CI verde; revisión de dueño I-2 pendiente en la aceptación |
| DOC-09 | F4 | I-2 | UI incidencias, expediente, bloqueos, vínculo a impacto | DOC-07, BASE-04 | MERGED | PR #22 (`4105962`) con CI verde; revisión de dueño I-2 pendiente en la aceptación |
| GRA-07 | F4 | I-3 | GraphViewer, explorador accesible, impacto, dashboard UI | GRA-06, REL-10, BASE-04 | MERGED | PR #22 (`4105962`), CI verde; grafo, leyenda, zoom y panel lateral verificados por E2E — TC-SESSION-20261128-I3-035 |
| TEST-01 | F5 | I-1 | TP y PS completos, SQL benchmark queries, evidencia | REL-12, DOC-07 | PENDING | — |
| TEST-02 | F5 | I-2 | PM completos, evidencia documental y matriz RF/RN | DOC-08, DOC-09 | PENDING | — |
| TEST-03 | F5 | I-3 | PG completos y Cypher benchmark queries | GRA-07 | PENDING | — |
| DEMO-01 | F5 | Equipo | Generar DEMO-150 por servicios/outbox, manifiesto y oráculo, validar conteos DA-01; I-1 datos/stock, I-2 calidad, I-3 grafo | REL-09, DOC-06, GRA-04, BASE-06 | TESTING | Manifiesto y oráculo generados por la semilla real en `tests/fixtures/demo/ampliada/`; 1/1 OK con 279 nodos/540 relaciones — TC-SESSION-20261128-I3-035; falta repetición en entorno limpio con UUID oficiales |
| DEMO-02 | F5 | Equipo | Ejecutar DA-02..07 y documentar evidencia; I-3 recorridos/UI, I-2 investigación, I-1 inventario/recuperación | DEMO-01, GRA-07, DOC-09, REL-12 | TESTING | DA-01..07 por servicios/drivers y cobertura UI con E2E 19/19 — TC-SESSION-20261128-I3-035; falta aceptación humana |
| TEST-04 | F5 | Equipo | PI, E2E, fallos/recuperación, accesibilidad, CI y aceptación | TEST-01, TEST-02, TEST-03, DEMO-02 | TESTING | E2E 21/21, Lighthouse 1.00, auditoría funcional con registros nuevos 1/1 — TC-SESSION-20261128-I3-037; PI y aceptación humana pendientes |
| BENCH-01 | F5 | Equipo | Generador y QE-01..05 equivalentes, casos base + volumen fijo/topologías, métricas reales CSV/JSON y DA-08 | TEST-01, TEST-03, BASE-06 | TESTING | Nueve perfiles repetidos sin errores: 2 700 mediciones, 45/45 equivalencias, EXPLAIN/PROFILE y 180 peticiones API — TC-SESSION-20261127-I3-026/027/028/029; BFS deduplicado resolvió el timeout QE-03 |
| RELSE-01 | F5 | Equipo | README, informe, revisión final, PR develop→main y tag si aprobado | TEST-04, BENCH-01 | IN_PROGRESS | README y matriz de aceptación escritos; faltan revisión humana, PR a `main` y tag — TC-SESSION-20261128-I3-035 |

Total línea base v1.0: 40 tareas. Total línea base v1.1 (2026-11-25): 42 tareas, dos nuevas DEMO-01/02. Estado observado 2026-11-28: 6/42 MERGED (GRA-01, BASE-04, REL-12, DOC-08, DOC-09, GRA-07), 4/42 TESTING, 3/42 IN_PROGRESS, 1/42 BLOCKED, 2/42 READY y 26/42 PENDING; 0/42 VERIFIED con aceptación humana. Progreso de desarrollo 6/42 = 14,3 %; progreso de verificación 6/42 = 14,3 %. No son estimaciones de horas.

## 4. Checkpoint por integrante (editar solo sección propia)
### I-1 PostgreSQL / operaciones / infraestructura
- Rama actual: `feature/pg-base05-contracts`, creada desde `develop` (`f82fd16`). Las ramas previas de I-1 ya están integradas en `develop`.
- Siguiente: cerrar BASE-05 con `typecheck`/`build` y lockfile, y ejecutar el smoke de BASE-02; las interfaces frontend de I-1 siguen pospuestas por decisión del equipo.
- Estado: bootstrap, entorno, esquema, transacciones, repositorios, autenticación, casos de uso, dashboard y detalle están integrados; BASE-05 se está completando y BASE-02 se valida con override de pruebas. Ninguna tarea se marca VERIFIED sin evidencia de motores reales.
- Artefactos: `package.json` raíz con workspaces, `backend/package.json`, `frontend/package.json`, `packages/contracts/package.json`, `tsconfig*`, `.nvmrc`, `.editorconfig`, `.prettierrc.json`, `eslint.config.mjs`, `.env.example`, `docker-compose.yml` (5 servicios, volúmenes y DB en loopback), `.github/workflows/ci.yml`, `packages/contracts/src/**`, `docker-compose.test.yml` y `tests/integration/engines-smoke.mjs`.
- BASE-02 (validación formal): el entorno de pruebas usa `docker compose -f docker-compose.yml -f docker-compose.test.yml` y publica PostgreSQL en `127.0.0.1:55432:5432` para **no detener ni interferir** con el PostgreSQL local del equipo en 5432. MongoDB (27017) y Neo4j (7474/7687) se mantienen según `PROJECT.md` §5. El smoke verifica `SELECT 1`, `ping` y `RETURN 1` con credenciales tomadas del entorno. Resultado de ejecución: pendiente de que termine la instalación de dependencias; no se afirma exitoso prematuramente.
- Archivos recientes / pruebas / PR: `packages/contracts/src/**` (4/4 pruebas de contratos), `tests/unit/base02-validation.spec.mts` y los artefactos integrados. Pruebas previas en `develop`: bootstrap 9/9, esquema 7/7, transaccional 7/7, incidencias/auth 10/10, operaciones 9/9, dashboard/detalle 6/6, I-2 84/84 y estáticas 309/309. `npm ci`, `typecheck`, `build`, smoke de motores y PM/TP/PI/E2E: en curso o NOT_RUN según corresponda. PR pendiente; sin merge a `develop`.

### I-2 MongoDB / calidad / documentación
- Rama actual: documentación en `docs/incorporar-reglas-i2`; código en `feature/mongo-schema` (creada desde `develop`, sin integrar). Últimos commits verificados: `6772185` (vista de incidencias, 7 pruebas), `4830165` (formulario dinámico, 6 pruebas), `beb3e88` (bloqueo/liberación, 14 pruebas), `0f77a5f` (ciclo de incidencias, 10 pruebas), `febdcfa` (expediente CAS, 14 pruebas), `6e1c172` (agregaciones, 9 pruebas), `09a7dec` (validador, 18 pruebas), `2623222`/`290ce0b` (capa documental), checkpoints `943f37f`/`3ef30aa`/`4cb50dd`/`259ff73`/`524cd09`.
- Siguiente: **no queda trabajo de I-2 que no requiera integración**; BASE-03 sigue pendiente de revisión del equipo, ratificación D-002, Issues y decisión sobre el commit `130868b` de `develop`. Cuando BASE-01/02/04/05 estén verificadas: aplicar validadores e índices, cargar plantillas, ejecutar PM/TP/PI/E2E y migrar los `.mts` a `.ts`/`.tsx` conectando los puertos a adaptadores reales. Plan detallado en `docs/plan-ejecucion-i2.md`.
- Estado: las nueve tareas específicas de I-2 (DOC-01..DOC-09) tienen artefactos con pruebas unitarias, pero ninguna está VERIFIED ni MERGED: faltan MongoDB real, NestJS, contratos e integración. El porcentaje formal sigue en 0 % (PROGRESS §1). No se cuenta código generado como verificado.
- Artefactos de diseño (permitidos en paralelo según plan §5): tres esquemas `$jsonSchema`, diez índices, seis plantillas v1, aplicador, sembrador, `backend/src/modules/inspections/parameters.validator.mts` (18 pruebas), `backend/src/modules/quality/quality-aggregations.mts` (9 pruebas), `backend/src/modules/incidents/dossier.mts` (14 pruebas: CAS, replay, handlers y respuesta 202) , `backend/src/modules/incidents/incident-lifecycle.mts` (10 pruebas), `backend/src/modules/lot-blocks/block-service.mts` (14 pruebas: verificación de grafo, todo o nada, retiro individual), `frontend/src/features/inspections/inspection-form.mts` (6 pruebas) y `frontend/src/features/incidents/incident-view.mts` (7 pruebas). Se usa `.mts` para ejecutar con `node --experimental-strip-types` mientras `backend/package.json` y `frontend/package.json` están vacíos (I-1); se convertirá a `.ts`/`.tsx` cuando BASE-01 y BASE-04 lo habiliten.
- Dependencias: I-1 LotReader/ProductReader/IncidentWriter/BlockWriter/OutboxWriter y repos SQL (REL-02/03/06); I-3 TraceabilityReader y verifyDescendant (GRA-03/05); coordinación BASE-05/06, BASE-04 para UI.
- Archivos recientes / pruebas / PR: siete Markdown en raíz, `docs/rol-i2.md`, `docs/plan-ejecucion-i2.md`, `database/document/**`, `backend/src/modules/inspections/**`, `backend/src/modules/quality/**` y `backend/src/modules/incidents/**`. Pruebas ejecutadas (2026-11-26): `node database/document/tests/static-check.mjs` → 309 verificaciones OK; `node --experimental-strip-types --test <7 suites de backend y frontend>` → 78/78 OK (18+9+14+10+14+6+7). PM-01..23 y lint/typecheck/build: NOT_RUN (sin BASE-01/02 ni dependencias instaladas). PR: pendiente; `gh` no disponible en este entorno.
### I-3 Neo4j / trazabilidad / UX
- 2026-11-27: timeout de QE-03 SQL resuelto con BFS deduplicado (`UNION` sin arreglo `seen`); nueve perfiles repetidos con 2 700 mediciones, 45/45 equivalencias y 0 errores. TC-SESSION-20261127-I3-029.
- 2026-11-27: latencia API extremo a extremo ejecutada en seis endpoints con 180 peticiones y 0 errores; evidencia en `docs/pruebas/api-latency-actual.{json,csv}` y TC-SESSION-20261127-I3-028. No comparable con las mediciones de motores.
- 2026-11-27: EXPLAIN ANALYZE y PROFILE ejecutados por separado en 1 000 lotes/profundidad 8; planes en `docs/pruebas/benchmark-plans.json` y TC-SESSION-20261127-I3-027. No se mezclan con la latencia.
- 2026-11-27: DA-08 ampliado con nueve perfiles (base, profundidad y topologías): 2 700 mediciones, 45/45 equivalencias y 60 timeouts de QE-03 SQL registrados a profundidad 15. Resumen en `docs/pruebas/benchmark-actual.{json,csv}` y TC-SESSION-20261127-I3-026. Sin EXPLAIN ni medición API.
- 2026-11-27: benchmark QE-01..05 base integrado en `develop` por PR #15 (`4443424`), CI `verify` success; 900 mediciones reales, equivalencia verificada y 0 errores. Resumen en `docs/pruebas/benchmark-actual.{json,csv}` y TC-SESSION-20261127-I3-024/025.
- 2026-11-27: revisión humana aprobada; PR #12 fusionado en `develop` (`a3b3b51`, 06:34:16Z) con commits `f967f85` y `a701ee1`. Check `verify` aún `in_progress` al consultar; no afirmar CI verde. Ver TC-SESSION-20261127-I3-019/020.
- 2026-11-27: DEMO-150 funcional por servicios/Outbox 1/1 OK con 279 nodos y 540 relaciones; DA-01..07 por servicios/drivers con evidencia en `docs/pruebas/demo150-actual.json` y TC-SESSION-20261127-I3-018. Sin DA-08/QE, UI/E2E ni CI de rama.
- 2026-11-27: carreras SQL y recuperación Outbox probadas con motores reales 2/2 (incluidas en el conjunto 5/5); evidencia en `docs/pruebas/concurrency-recovery-actual.json` y TC-SESSION-20261127-I3-017.
- Continuación 2026-11-26/27 de `feature/pg-operational-integration`: escenario canónico por servicios/Outbox con 9 lotes, 5 órdenes, 3 distribuciones, 4 inspecciones, 1 incidencia EN_ANALISIS, expediente, bloqueos temporales, impacto integrado y cinco modalidades de trazabilidad. Impacto y trazabilidad por HTTP probados solo en escenario reducido; no es seed final con UUID fijos. Véase TC-SESSION-20261126-I3-013..015 y TC-SESSION-20261127-I3-016, más `docs/pruebas/canonical-multimodel-actual.json`. Frontend, DEMO-150 y QE sin ejecutar.
- Rama de integración actual: `feature/pg-operational-integration`, basada en `c7cfe49`; cambios de I-1/I-2 autorizados por el usuario para terminar operaciones SQL/API y calidad/incidencias. Revisión humana de dueños pendiente, sin commit/PR/merge de esta rama. Backend únicamente: no se inició frontend.
- Incremento de prueba real reducido: recepción→producción→distribución HTTP→SQL→Outbox→Neo, inspección HTTP→Mongo, incidencia HTTP→SQL→Outbox→expediente Mongo; esquema SQL/Base Mongo temporales e IDs propios. No es semilla canónica ni DEMO-150. REL-06/GRA-02 y tareas I-1/I-2 conservan estado parcial hasta revisión/cobertura completa. QE-01..05 y DA-01..08 NOT_RUN; véase TC-SESSION-20261126-I3-012.
- Continuación backend de `feature/graph-traversals`: `backend/src/database/neo4j/subgraph.mts` obtiene tramos productivos de Neo4j, mantiene extremos presentes y separa truncamiento visual del análisis. I-3 no inició Next.js ni pidió declarar RF-28/GRA-07 completados: faltan integración API, enriquecimiento oficial y vista.
- Rama `feature/graph-traversals`: recorrido Neo y distribución con pruebas reales en proyección aislada; la topología ficticia de nueve lotes no equivale a seed multimodelo. GRA-03/GRA-05 siguen PENDING hasta verificar sus dependencias/contrato completo; GRA-04 BLOCKED por REL-09 pese al código parcial. Evidencia provisional para póster en `RESULTADOS_POSTER.md` y `docs/pruebas/`, su consolidación requiere revisión de I-2.
- PR #11 de `feature/graph-outbox-integration` fusionado en `develop` (`11ca103`, verificación Git/GitHub). El check `verify` del merge seguía `in_progress` al consultarlo; no afirmar CI verde. GRA-02 y REL-06 permanecen IN_PROGRESS: el código está integrado, pero B-008 impide marcar tareas completas sin operación SQL/API real.
- Rama `feature/graph-outbox-integration` (desde checkpoint `f4312de`): GRA-02 IN_PROGRESS con handler Neo4j y pruebas de motor; coordinación con I-1/I-2 para idempotencia SQL, handler Mongo y arranque de ambos workers. Autorización de I-1/I-2 comunicada por el usuario; revisión humana de ambos aún pendiente. No iniciar frontend.
- Checkpoint posterior a PR #10: `feature/graph-schema` quedó integrada en `develop` por PR #9 (`b0e6894`); dispatcher Outbox parcial integrado por PR #10 (`9d5f196`). GRA-01 MERGED; GRA-02 sigue PENDING por REL-06 incompleta. `main.ts` y `app.module.ts` vacíos, `createIdempotencyStore` usa `Map` y falta registrar adaptadores reales Neo4j/MongoDB; no afirmar arranque integrado. Build frontend bloqueado por BASE-04 pospuesta.
- `feature/pg-outbox-dispatcher` (base `b0e6894`): dispatcher REL-06 implementado y probado con PostgreSQL. PR #9 integrado; faltan registro de handlers y arranque del consumidor desde la aplicación.
- Rama actual: `feature/graph-schema`, actualizada con `origin/develop` (`87206c5`); commits locales `470e21d`, merge `55736f5` y corrección de infraestructura autorizada `ede63a8`; PR pendiente.
- Siguiente: revisión/PR de GRA-01 y coordinación de REL-06 antes de iniciar GRA-02. BASE-04, Cytoscape.js y todo frontend continúan pospuestos por decisión expresa durante esta fase.
- Estado: GRA-01 **VERIFIED** localmente, no `MERGED`: exactamente 6 constraints de nodo, 7 constraints de relación y 6 índices de código aplicados en Neo4j 5.26 Community mediante scripts idempotentes. BASE-02 pasó smoke 3/3 con el override corregido y BASE-05 pasó typecheck/build específico. B-004 resuelto.
- Archivos recientes / pruebas / PR: `database/graph/schema/001_node_constraints.cypher`, `002_relationship_constraints.cypher`, `003_indexes.cypher`, `database/graph/apply-schema.mjs`, pruebas estática/integración en `database/graph/tests/**`; correcciones autorizadas en `docker-compose.test.yml`, `tests/unit/base02-validation.spec.mts` y `tests/integration/engines-smoke.mjs`. TDD rojo 0/4 por scripts ausentes → verde 4/4; integración real 2/2; segunda aplicación idempotente exit 0. `npm ci` con Node 22.22.0/npm 10.9.4 exit 0; contratos typecheck/build exit 0; typecheck global FALLÓ en archivos preexistentes de backend/frontend ajenos a I-3 y build global no se ejecutó por `&&`. PG/PI/E2E/QE/DA: NOT_RUN.
- Corrección CI para PR #9 (2026-11-26): `frontend/package.json` ahora incluye `.mts` en lint y `eslint.config.mjs` ya no los ignora. `npm run lint` pasó con Node 22.22.0/npm 10.9.4; los cuatro `.mts` actuales de frontend sí se revisan. `npm run typecheck` sigue FALLANDO por TS5097 en backend/frontend y TS2352/TS2339 en código ajeno; B-005 permanece abierto. Cambios de configuración compartida requieren revisión de I-1 en PR.
- Corrección coordinada de tipos (2026-11-26): backend reescribe imports relativos `.mts` a `.mjs` en la salida; frontend admite `.mts` para typecheck sin emisión. Se tipó el resultado de reserva como unión discriminada y se eliminaron conversiones inseguras del patch del expediente. `npm run typecheck` ahora pasa en los tres workspaces. Build backend/contratos pasa, pero build global falla porque Next.js no tiene todavía `app/` ni `pages/` (BASE-04 pospuesta); `test:integration` falla por ausencia de `backend/test/jest-integration.json`. PR #9 sigue pendiente de revisión; no declarar CI verde.
- Corrección del harness de integración autorizada (2026-11-26): `test:integration` ejecuta smoke real de PostgreSQL/MongoDB/Neo4j, aplica esquema Neo4j y corre 3 pruebas Jest reales de conectividad/esquema (3/3 OK local). CI ahora arranca motores aislados con credenciales efímeras y `docker-compose.test.yml`, ejecuta integración antes de build y retira solo los contenedores de prueba. BASE-04 permanece pospuesta por elección expresa del usuario: `next build` sigue fallando y PR #9 no está listo para merge.

## 5. Estado RF (fuente REQUIREMENTS.md)

> Registro histórico: las filas conservan el estado original; la correlación con evidencia ejecutada está en `docs/pruebas/acceptance-matrix.md`. No se marcan VERIFIED sin aceptación humana.

| RF | Funcionalidad | Estado | Evidencia |
|---|---|---|---|
| RF-01 | Iniciar y cerrar sesión con cuentas precargadas; rechazar credenciales inválidas e cerrar sesión local y rechazar token expirado o cuenta inactiva. | PENDING | — |
| RF-02 | Aplicar roles OPERADOR y ANALISTA_CALIDAD en backend y navegación; denegar acciones no autorizadas. | PENDING | — |
| RF-03 | Dashboard básico con conteos, actividad reciente y accesos permitidos; sin gráficas avanzadas en dashboard; calidad tiene resumen propio. | PENDING | — |
| RF-04 | Gestionar proveedores (crear, listar, editar datos descriptivos, desactivar); preservar historial. | PENDING | — |
| RF-05 | Gestionar productos con tipo y unidad fija; listar, editar y desactivar sin romper historial. | PENDING | — |
| RF-06 | Gestionar ubicaciones; impedir desactivación con stock positivo. | PENDING | — |
| RF-07 | Registrar recepción de materia prima; crear lote único, existencia, movimiento y evento SQL atómicamente. | PENDING | — |
| RF-08 | Consultar inventario por lote, producto y ubicación; diferenciar stock físico y utilizable. | PENDING | — |
| RF-09 | Consultar detalle integrado de lote, movimientos, proveedor/origen, calidad y procedencia. | PENDING | — |
| RF-10 | Buscar y filtrar catálogos, lotes y operaciones; paginar listados. | PENDING | — |
| RF-11 | Registrar producción completada con una o más entradas y salidas; actualizar inventario y generar nuevos lotes en una transacción. | PENDING | — |
| RF-12 | Admitir transformaciones multinivel; un lote fabricado puede ser insumo de otra producción. | PENDING | — |
| RF-13 | Consultar listado y detalle de producciones con consumos, resultados y movimientos. | PENDING | — |
| RF-14 | Registrar distribución completada de uno o más lotes entre ubicaciones; conservar ID y transferir stock atómicamente. | PENDING | — |
| RF-15 | Consultar historial de distribuciones con origen, destino, cantidades y fecha. | PENDING | — |
| RF-16 | Cargar plantilla preconfigurada específica por producto o general; generar campos y validar contra la versión. | PENDING | — |
| RF-17 | Registrar inspecciones variables con resultado, parámetros, observaciones, hallazgos y referencias de evidencias. | PENDING | — |
| RF-18 | Consultar historial y detalle de inspecciones de lote; permitir filtros por producto y resultado. | PENDING | — |
| RF-19 | Obtener agregaciones básicas de calidad por producto/resultado y tipo de hallazgo (incluye resumen y gráfica simple de no conformidad y hallazgos). | PENDING | — |
| RF-20 | Crear incidencia con lote origen, clasificación, severidad y expediente, con o sin inspección previa, expediente versionado. | PENDING | — |
| RF-21 | Consultar incidencias y su expediente; indicar estado de persistencia documental. | PENDING | — |
| RF-22 | Asociar inspecciones y referencias de evidencia al expediente, preservando referencias válidas. | PENDING | — |
| RF-23 | Gestionar estados ABIERTA → EN_ANALISIS → CERRADA; registrar resolución y no reabrir. | PENDING | — |
| RF-24 | Trazabilidad hacia adelante: descendientes únicos, nivel directo/indirecto y destinos. | PENDING | — |
| RF-25 | Trazabilidad hacia atrás: antecedentes, procesos y proveedores de origen. | PENDING | — |
| RF-26 | Orígenes comunes: intersección de antecedentes de dos a cinco lotes distintos; solo analista. | PENDING | — |
| RF-27 | Caminos: encontrar rutas dirigidas entre dos lotes, con procesos y límites. | PENDING | — |
| RF-28 | Visualizar grafos interactivos, selección de nodos, zoom/desplazamiento y detalle; alternativa textual. | PENDING | — |
| RF-29 | Calcular impacto potencial desde el lote de origen; deduplicar y clasificar por profundidad mínima. | PENDING | — |
| RF-30 | Reporte integrado: cantidades por lote/unidad/ubicación, destinos históricos, calidad y relaciones; mostrar faltantes. | PENDING | — |
| RF-31 | Aplicar bloqueos manuales por lote e incidencia con justificación; impedir nuevas producciones/distribuciones. | PENDING | — |
| RF-32 | Retirar restricciones individualmente con motivo; mantener bloqueo mientras exista otra restricción activa. | PENDING | — |
| RF-33 | Proyectar operaciones SQL a Neo4j mediante outbox persistente con reintentos idempotentes. | PENDING | — |
| RF-34 | Crear/actualizar expediente en MongoDB mediante mecanismo recuperable cuando SQL origina el cambio; verificar referencias compartidas. | PENDING | — |
| RF-35 | Exponer estado de sincronización y disponibilidad; distinguir resultado vacío válido, parcial y no disponible. | PENDING | — |

## 6. Estado API (actualizar al implementar y probar)

> Registro histórico: la verificación real de rutas está en `tests/integration/read-api.integration.mjs`, `tests/integration/operations-http.integration.mjs`, `docs/pruebas/api-latency-actual.json` y la suite E2E.

| Método/ruta | Estado | Evidencia |
|---|---|---|
| POST /auth/login | PENDING | — |
| GET /auth/me | PENDING | — |
| GET /suppliers | PENDING | — |
| GET /suppliers/:id | PENDING | — |
| POST /suppliers | PENDING | — |
| PATCH /suppliers/:id | PENDING | — |
| PATCH /suppliers/:id/status | PENDING | — |
| GET /products | PENDING | — |
| GET /products/:id | PENDING | — |
| POST /products | PENDING | — |
| PATCH /products/:id | PENDING | — |
| PATCH /products/:id/status | PENDING | — |
| GET /locations | PENDING | — |
| GET /locations/:id | PENDING | — |
| POST /locations | PENDING | — |
| PATCH /locations/:id | PENDING | — |
| PATCH /locations/:id/status | PENDING | — |
| GET /lots | PENDING | — |
| GET /lots/:id | PENDING | — |
| POST /lots/receipts | PENDING | — |
| GET /inventory | PENDING | — |
| GET /inventory/movements | PENDING | — |
| GET /lots/:id/details | PENDING | — |
| GET /production-orders | PENDING | — |
| GET /production-orders/:id | PENDING | — |
| POST /production-orders | PENDING | — |
| GET /distributions | PENDING | — |
| GET /distributions/:id | PENDING | — |
| POST /distributions | PENDING | — |
| GET /inspection-templates/active | PENDING | — |
| GET /inspection-templates/:id | PENDING | — |
| GET /inspections | PENDING | — |
| GET /inspections/:id | PENDING | — |
| POST /inspections | PENDING | — |
| GET /quality/summary | PENDING | — |
| GET /quality/findings | PENDING | — |
| GET /incidents | PENDING | — |
| GET /incidents/:id | PENDING | — |
| POST /incidents | PENDING | — |
| GET /incidents/:id/dossier | PENDING | — |
| PATCH /incidents/:id/dossier | PENDING | — |
| POST /incidents/:id/start-analysis | PENDING | — |
| POST /incidents/:id/close | PENDING | — |
| GET /incidents/:id/blocks | PENDING | — |
| POST /incidents/:id/blocks | PENDING | — |
| GET /lots/:id/blocks | PENDING | — |
| POST /lot-blocks/:id/release | PENDING | — |
| GET /traceability/:lotId/forward | TESTING | HTTP reducido 200/401/400/404; canónico por servicio 4 descendientes — TC-SESSION-20261126-I3-016 |
| GET /traceability/:lotId/backward | TESTING | HTTP reducido 200; canónico 4 antecedentes y 3 proveedores — I3-016 |
| GET /traceability/:lotId/genealogy | TESTING | HTTP reducido 200; canónico 4 antecedentes sin descendientes — I3-016 |
| POST /traceability/common-origins | TESTING | HTTP reducido 200/403; canónico MP-001/MP-002 con depthByRoot — I3-016 |
| POST /traceability/paths | TESTING | HTTP reducido 200/400; canónico profundidad 2 y sin ruta — I3-016 |
| GET /incidents/:id/impact | TESTING | HTTP reducido PARCIAL/COMPLETO; canónico por servicio — I3-015 |
| GET /dashboard/summary | PENDING | — |
| GET /dashboard/recent-activity | PENDING | — |
| GET /system/sync-status | PENDING | — |
| GET /health | PENDING | — |

## 7. Estado persistencia
| Artefacto | Estado | Evidencia |
|---|---|---|
| E-01 usuarios | PENDING | — |
| E-02 proveedores | PENDING | — |
| E-03 productos | PENDING | — |
| E-05 ubicaciones | PENDING | — |
| E-04 lotes | PENDING | — |
| E-06 existencias | PENDING | — |
| E-07 movimientos | PENDING | — |
| E-08 ordenes_produccion | PENDING | — |
| E-09 consumos_produccion | PENDING | — |
| E-10 resultados_produccion | PENDING | — |
| E-11 distribuciones | PENDING | — |
| E-12 detalle_distribuciones | PENDING | — |
| E-15 incidencias | PENDING | — |
| E-17 bloqueos_lotes | PENDING | — |
| E-18 eventos_sincronizacion | PENDING | — |
| E-19 solicitudes_idempotentes | PENDING | — |
| E-14 plantillas_inspeccion | PENDING | — |
| E-13 inspecciones_calidad | PENDING | — |
| E-16 expedientes_incidencias | PENDING | — |
| schema_migrations | PENDING | — |
| v_inventario | PENDING | — |
| v_estado_lotes | PENDING | — |
| v_dependencias_productivas | PENDING | — |
| Nodo Proveedor | PENDING | — |
| Nodo Producto | PENDING | — |
| Nodo Lote | PENDING | — |
| Nodo Proceso | PENDING | — |
| Nodo Distribucion | PENDING | — |
| Nodo Ubicacion | PENDING | — |
| SUMINISTRA | PENDING | — |
| CORRESPONDE_A | PENDING | — |
| UTILIZADO_EN | PENDING | — |
| GENERA | PENDING | — |
| INCLUIDO_EN | PENDING | — |
| SALE_DE | PENDING | — |
| ENTREGADO_A | PENDING | — |
| 6 plantillas v1 | PENDING | — |
| Fixture oficial y expected-results | PENDING | — |

## 8. Pruebas y evidencia
| Suite | Estado | Comando/resultado/fecha |
|---|---|---|
| Unitarias backend | NOT_RUN | — |
| Unitarias frontend | NOT_RUN | — |
| TP-01..25 | NOT_RUN | — |
| PM-01..23 | NOT_RUN | — |
| PG-01..22 | NOT_RUN | — |
| PI-01..14 | NOT_RUN | — |
| PS-01..12 | NOT_RUN | — |
| E2E-01..05 | NOT_RUN | — |
| Lint / typecheck / build | VERIFIED | `npm run lint`, `npm run typecheck` y `npm run build` globales OK en CI del PR #13 (`verify` success, 2026-11-27T06:47:24Z); backend 55/55 unitarias y 6/6 integración locales |
| Accesibilidad / aceptación | NOT_RUN | — |
| QE-01..05 benchmark | TESTING | Nueve perfiles repetidos: 2 700 mediciones, 450 calentamientos, 45/45 equivalencias y 0 errores; QE-03 SQL optimizado de timeout a mediana 4.149 ms a 10 000 lotes — `docs/pruebas/benchmark-actual.{json,csv}` |
| DA-01..08 demo ampliada y evidencia analítica | TESTING | DA-01..07 por servicios/drivers 1/1 OK; DA-08 con nueve perfiles sin errores, EXPLAIN/PROFILE y latencia API ejecutados; queda UI/E2E |

Registrar por ejecución: fecha UTC, integrante, rama/commit, entorno, comando exacto, número de tests pasados/fallidos/omitidos si disponible, duración si medida, enlace de log/PR, fallo y siguiente acción. Nunca inventar resultados. Actualizar por ID específico cuando proceda.

## 9. Bloqueadores y decisiones
| ID | Estado | Descripción | Responsable / acción |
|---|---|---|---|
| B-001 | Resuelto 2026-11-28 | Repositorio, ramas, dependencias y bootstrap inspeccionados; `npm ci`, lint, typecheck, build, motores y CI verificados en `develop` | Evidencia en sesiones I3-031..035 y check `verify` success de `4105962` |
| B-002 | Pendiente de coordinación | Nombres nominales de I-1 e I-3, accesos/revisores | Equipo confirmar; no bloquea diseño por rol |
| B-003 | Resuelto 2026-11-28 para el alcance implementado | Stack compila y CI pasa; identidad visual documentada en `frontend/DESIGN.md` y aplicada en las 14 vistas | Falta ratificación humana de D-003 y revisión de dueños I-1/I-2 sobre features tocadas |
| B-004 | Resuelto 2026-11-26 | BASE-05 fue integrado en `origin/develop`; BASE-02 pasó smoke real 3/3 tras corregir el reemplazo del puerto PostgreSQL y la importación CommonJS de `pg` | Evidencia en sesión I3-002; GRA-01 ejecutada sin cambiar contratos |
| B-005 | Resuelto localmente 2026-11-26, PR pendiente | Typecheck global pasó tras corregir imports `.mts` y dos errores de tipos con autorización de I-1/I-2 | Revisión humana de dueños y repetir CI en PR #9 |
| B-006 | Resuelto 2026-11-27 | El build global fallaba por ausencia de `app/` o `pages/` en Next.js. El usuario autorizó un esqueleto mínimo (`src/app/layout.tsx`, `src/app/page.tsx`) sin vistas funcionales; `next build` pasa en CI del PR #13 | Verificado: `verify` success en run 45953924797; BASE-04 sigue pospuesta, no se implementaron vistas de negocio |
| B-007 | Resuelto localmente 2026-11-26, PR pendiente | `npm run test:integration` realiza smoke 3/3 y 3/3 pruebas Jest reales sobre motores aislados; CI configura motores antes de la ejecución | Revisar CI en GitHub con I-1; no sustituye PM/TP/PI/E2E completos |
| B-008 | Resuelto 2026-11-27 | Operaciones SQL/API completas y eventos con extremos/IDs reales; flujo HTTP→SQL→Outbox→Neo verificado en pruebas reducida, canónica y DEMO-150, integrado por PR #12 (`a3b3b51`). | Evidencia en `tests/integration/operations-http.integration.mjs`, `canonical-operations.integration.mjs` y `demo150-seed.integration.mjs`; no equivale a aceptación completa ni CI verde |

Registro de decisiones: D-001 línea base documental v1.0, 2026-11-25. Integra decisiones de conversaciones y cierra detalles operativos en los seis archivos de especificación. Validación de equipo y pruebas de implementación pendientes. Para nuevas decisiones: ID, fecha, propuesta, alternativas, impacto en RF/RN/API/datos, aprobación humana, PR; actualizar documentos normativos, no solo esta sección.

D-002 — revisión documental v1.1, 2026-11-25. Solicitada por el integrante 2: conservar el alcance reducido y fortalecer el papel analítico de Neo4j e integración Mongo/SQL. Alternativa descartada por ahora: añadir colecciones, etiquetas o módulos solo para aumentar tamaño. Se agrega DEMO-150 separado del fixture canónico, oráculo analítico, DA-01..08 y tareas DEMO-01/02; BENCH-01 refuerza pruebas de profundidad/topología. 40→42 tareas, RF/RNF y contratos sin cambios. Los otros tres documentos conservan contenido v1.0. Aprobación de la actualización documental por solicitante; ratificación del equipo, Issue/PR y verificación de repo pendientes. Ninguna prueba de software ejecutada.

D-003 — paleta de interfaz propuesta e implementada, 2026-11-27. El usuario delegó la elección. Se adopta un sistema Restrained para modo Operate: canvas `#F6F8FB`, superficie `#FFFFFF`, superficies secundarias `#EEF2F7`/`#E4EAF2`, tinta `#0B1220`, texto secundario `#526071`, borde `#D8E0EA`/`#B9C5D4`, primario `#2563EB` (contrato), hover `#1D4ED8`, activo `#1E40AF`, y semánticos éxito `#15803D`, aviso `#B45309`, error `#DC2626`. AI-15: `taste-skill` prohíbe violeta en el diseño propio, pero `PROJECT.md` fija `#7C3AED` para el grafo; se resuelve conservando ese violeta **solo como color semántico de datos del grafo**, nunca como acento decorativo de la interfaz. No se modifica API_CONTRACT ni la paleta referencial de PROJECT; la identidad institucional sigue sin certificar.

## 10. Historial de sesiones (append-only)
### TC-SESSION-20261125-DOC-001
- Fecha: 2026-11-25. Responsable: preparación de documentación (no commit del equipo).
- Objetivo: consolidar siete documentos v1.0 y punto de control.
- Resultado: especificaciones Markdown preparadas; ningún código, esquema, servicio, GitHub Issue o pipeline ejecutado por esta tarea.
- Archivos: PROJECT.md, AGENTS.md, REQUIREMENTS.md, BUSINESS_RULES.md, DATA_MODEL.md, API_CONTRACT.md, PROGRESS.md.
- Rama/commit/PR: no disponible. Pruebas del software: NOT_RUN.
- Próximo paso: copiar documentos a raíz del repo; BASE-03/BASE-01; confirmar contratos y arranque F0.

### TC-SESSION-20261125-DOC-002
- Fecha: 2026-11-25. Responsable: revisión documental a solicitud de I-2 (no commit del equipo).
- Objetivo: D-002; reforzar defensa del grafo, escenario DEMO-150 y criterios DA-01..08 sin aumentar alcance.
- Resultado: cuatro Markdown revisados, tres conservados byte por byte. Backlog 40→42, nuevas tareas PENDING; benchmark actualizado como criterio pendiente. No se modificó código, DB, contratos ni repositorio.
- Archivos: PROJECT.md, DATA_MODEL.md, REQUIREMENTS.md, PROGRESS.md.
- Rama/commit/PR: no disponible. Pruebas del software: NOT_RUN; revisión documental no equivale a prueba de implementación.
- Próximo paso: BASE-03 y BASE-01, revisar v1.1 con equipo, preparar contratos y entorno; ejecutar DEMO-01/02 y BENCH-01 cuando se cumplan dependencias.
### TC-SESSION-20261126-I2-001
- Fecha: 2026-11-26. Responsable: I-2 (rama `docs/incorporar-reglas-i2`).
- Objetivo: BASE-03 parcial — incorporar la línea base v1.1 al repositorio, ignorar la carpeta de trabajo del agente y proponer un plan de ejecución para la parte documental.
- RF/RN: no se modifica ningún RF/RN; se respeta D-002 (AGENTS/BUSINESS_RULES/API_CONTRACT v1.0 y resto v1.1).
- Trabajo realizado: inspección real del repo (rama `feat/Implement`/`develop`, commit `11a1dbf`, remoto `EdwarDa2/TraceChain`, árbol con marcadores vacíos, sin `gh`, suites NOT_RUN); `.gitignore` con `/InformacionAgente/`; siete documentos copiados a raíz; prompt de rol en `docs/rol-i2.md`; plan `docs/plan-ejecucion-i2.md` con brechas, dependencias, secuencia DOC-01..09, TEST-02 e issues propuestas; `PROGRESS.md` actualizado en sección I-2, BASE-03 e historial.
- Archivos modificados: `.gitignore`, `AGENTS.md`, `PROJECT.md`, `REQUIREMENTS.md`, `BUSINESS_RULES.md`, `DATA_MODEL.md`, `API_CONTRACT.md`, `PROGRESS.md`, `docs/rol-i2.md`, `docs/plan-ejecucion-i2.md`.
- Rama/commit/PR: `docs/incorporar-reglas-i2`; `e847c92` (chore), `8443f77` (docs, incorporación); este punto de control se confirma en el commit siguiente de la rama. PR pendiente (sin `gh`; enlace manual posible).
- Pruebas reales: NOT_RUN. Sin bootstrap, `package.json` funcional ni scripts; no se ejecutaron lint, typecheck, tests ni build. No se inventaron resultados.
- Bloqueadores/dependencias/decisiones: B-001 inspeccionado por I-2 pero no resuelto (falta BASE-01/02 de I-1); B-002 y B-003 pendientes; estructura `backend/src` no canónica requiere acuerdo (AI-11/AI-20); D-002 pendiente de ratificación; Issues no creadas.
- Próxima acción concreta: equipo ratifica línea base y plan, confirma roles y revisores; I-1 ejecuta BASE-01/02; con acceso a GitHub crear las issues propuestas; I-2 inicia DOC-01 solo con BASE-02 y BASE-05 verificadas.

### TC-SESSION-20261126-I2-002
- Fecha: 2026-11-26. Responsable: I-2 (rama `feature/mongo-document-schema`).
- Objetivo: primer incremento de la parte documental — diseño de validadores, índices y plantillas v1 dentro de `database/document/**`, sin invadir módulos ajenos ni inventar contratos.
- RF/RN: RNF-10, RF-16, RN-51..54/107/115/116; documentación v1.1 y eventos v1.0 sin cambios (D-002).
- Trabajo realizado: tres esquemas `$jsonSchema` strict/error para las 3 colecciones oficiales; 10 índices según DATA_MODEL §3; seis plantillas v1 con UUID de fixture 801..806 y productos 301/302/304/306/307/General-null; aplicador de validadores y sembrador idempotente con `$setOnInsert` y conversión Decimal128/Int32; verificación estática sin dependencias. DOC-01/DOC-02 permanecen PENDING porque requieren BASE-02 y BASE-05.
- Archivos modificados: `database/document/validators/*.schema.json`, `database/document/validators/apply-validators.mjs`, `database/document/indexes/create-indexes.mongosh.js`, `database/document/data/plantillas-inspeccion.json`, `database/document/data/seed-templates.mjs`, `database/document/tests/static-check.mjs`, `PROGRESS.md`.
- Rama/commit/PR: `feature/mongo-document-schema`; `aa0f405` (artefactos). PR pendiente; la rama deriva de la rama documental porque `develop` aún no contiene la línea base (AI-15: contradicción reportada).
- Pruebas reales: `node database/document/tests/static-check.mjs` → OK, 309 verificaciones, 2026-11-26. PM-01..23, lint, typecheck, build e integración: NOT_RUN, sin Mongo ni dependencias instaladas; no se inventaron resultados.
- Bloqueadores/dependencias/decisiones: B-001 abierto (falta BASE-01/02 de I-1); BASE-05 sin contratos compartidos; D-002 pendiente de ratificación; Issues no creadas (sin `gh`). No se agregaron colecciones ni dependencias fuera del stack.
- Próxima acción concreta: I-1 habilita BASE-01/02 y el equipo BASE-05; luego aplicar validadores e índices, cargar plantillas y ejecutar PM-01/02/07/11/12/23 sobre Mongo real.

### TC-SESSION-20261126-I2-003
- Fecha: 2026-11-26. Responsable: I-2 (rama `feature/mongo-schema`; punto de control en `docs/incorporar-reglas-i2`).
- Objetivo: siguiente funcionalidad de I-2 con pruebas desde el primer día — validación dinámica de parámetros de inspección contra la plantilla.
- RF/RN: RF-16/RF-17, RNF-06/RNF-10, RN-52/RN-55/RN-115; PM-05/PM-06; códigos de error oficiales mapeados a INVALID_INSPECTION_PARAMETERS (422).
- Trabajo realizado: `parameters.validator.mts` con comparación decimal exacta (BigInt, sin float), validación de TEXTO/ENTERO/DECIMAL/BOOLEANO/SELECCION, límites inclusivos, claves desconocidas, requeridos ausentes, Int32, 34 dígitos y plantillas inválidas; 18 pruebas unitarias. DOC-03 sigue PENDING: falta el servicio NestJS y `packages/contracts`.
- Archivos modificados: `backend/src/modules/inspections/parameters.validator.mts`, `backend/src/modules/inspections/parameters.validator.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: código en `feature/mongo-schema`, commit `09a7dec`; PR pendiente, sin integrar en `develop`. No se borró ninguna rama ni archivo.
- Pruebas reales: `node --experimental-strip-types --test backend/src/modules/inspections/parameters.validator.spec.mts` → 18/18 OK, 143 ms, 2026-11-26. Tres fallos iniciales por códigos internos inconsistentes fueron corregidos y conservan su registro en el historial de la rama. PM-01..23, lint, typecheck y build: NOT_RUN.
- Bloqueadores/dependencias/decisiones: B-001 abierto (BASE-01/02 de I-1); BASE-05 sin contratos; `.mts` elegido porque `backend/package.json` está vacío y Node rechaza módulos `.ts` bajo él — se convertirá a `.ts` tras BASE-01 (AI-15 reportado); D-002 pendiente de ratificación.
- Próxima acción concreta: repetir el patrón «funcionalidad + pruebas» para `QualityReader` y agregaciones (DOC-04) como lógica pura; mantener sin merge hasta que el equipo lo autorice.

### TC-SESSION-20261126-I2-004
- Fecha: 2026-11-26. Responsable: I-2 (rama `feature/mongo-schema`; punto de control en `docs/incorporar-reglas-i2`).
- Objetivo: continuar DOC-04 con el patrón funcionalidad + pruebas — agregaciones de calidad y puerto `QualityReader`.
- RF/RN: RF-19, RNF-10, RN-127, QM-02..08, PM-17/18; contratos de `API_CONTRACT.md` §2/§4/§8.
- Trabajo realizado: `quality-aggregations.mts` con resumen global, resumen por producto (productos sin inspecciones con 0 y porcentaje null; nombres desde PG), conteo de hallazgos por tipo/severidad con orden count desc y clave asc, resumen por lote con `latestInspectionId` determinista y `createQualityReader` con puertos inyectados que no convierten fallos en arreglos vacíos. Tipos estructurales temporales hasta BASE-05. DOC-04 sigue PENDING: faltan el adaptador Mongo y el controlador NestJS.
- Archivos modificados: `backend/src/modules/quality/quality-aggregations.mts`, `backend/src/modules/quality/quality-aggregations.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: código en `feature/mongo-schema`, commit `6e1c172`; PR pendiente, sin integrar en `develop`. No se borró nada.
- Pruebas reales: `node --experimental-strip-types --test backend/src/modules/quality/quality-aggregations.spec.mts` → 9/9 OK; suite conjunta de inspections + quality → 27/27 OK (2026-11-26). Cuatro fallos iniciales corregidos: fixture de 3/5 mal calculado, global que contaba productos fuera de catálogo y campo `total` en vez de `totalInspections` en `LotQuality`. PM-01..23, lint, typecheck y build: NOT_RUN.
- Bloqueadores/dependencias/decisiones: B-001 abierto (BASE-01/02 de I-1); BASE-05 sin contratos; `.mts` por `backend/package.json` vacío (AI-15 reportado); D-002 pendiente de ratificación. Sin mocks en aplicación integrada: los dobles de datos existen solo en pruebas aisladas.
- Próxima acción concreta: DOC-05 (repositorio de expediente y handlers Mongo) o DOC-06 (flujo de incidencias) siguiendo el mismo patrón, condicionado a BASE-05 y a que haya proyecto NestJS donde integrar los módulos.

### TC-SESSION-20261126-I2-005
- Fecha: 2026-11-26. Responsable: I-2 (rama `feature/mongo-schema`; punto de control en `docs/incorporar-reglas-i2`).
- Objetivo: siguiente tarea del orden del plan, DOC-05 — repositorio de expediente y handlers Mongo.
- RF/RN: RF-20/RF-22/RF-34, RN-63/RN-116, PM-12..16, eventos INCIDENCIA_REGISTRADA y EXPEDIENTE_ACTUALIZADO de API_CONTRACT §7.
- Trabajo realizado: `dossier.mts` con creación v1, CAS por incidencia_id y versión esperada, replay por ultimoEventoId, reemplazo total de arreglos, fechas de evidencia asignadas por servidor, validación de límites 50/30/20 y referencias distintas, manejo de carrera de inserción y respuesta 202 con `nextVersion` como `expectedVersion`. Incluye `createDossierRepository` con puerto inyectado; el adaptador Mongo real y el controlador NestJS siguen pendientes, por lo que DOC-05 permanece PENDING.
- Archivos modificados: `backend/src/modules/incidents/dossier.mts`, `backend/src/modules/incidents/dossier.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: código en `feature/mongo-schema`, commit `febdcfa`; PR pendiente, sin integrar en `develop`. No se borró nada.
- Pruebas reales: `node --experimental-strip-types --test backend/src/modules/inspections/parameters.validator.spec.mts backend/src/modules/quality/quality-aggregations.spec.mts backend/src/modules/incidents/dossier.spec.mts` → 41/41 OK (2026-11-26). Un fallo inicial por escenario de carrera mal simulado se corrigió y se volvió a ejecutar. PM-12..16 requieren MongoDB real: NOT_RUN. Lint/typecheck/build: NOT_RUN.
- Bloqueadores/dependencias/decisiones: B-001 abierto (BASE-01/02 de I-1); BASE-05 sin contratos; `.mts` por `backend/package.json` vacío (AI-15 reportado); D-002 pendiente de ratificación. Los dobles de almacén existen solo en pruebas aisladas.
- Próxima acción concreta: DOC-06 (flujo funcional de incidencias ABIERTA→EN_ANALISIS→CERRADA) con el mismo patrón de lógica pura y pruebas, respetando el orden del plan.

### TC-SESSION-20261126-I2-006
- Fecha: 2026-11-26. Responsable: I-2 (rama `feature/mongo-schema`; punto de control en `docs/incorporar-reglas-i2`).
- Objetivo: continuar el orden del plan con DOC-06 — flujo funcional de incidencias.
- RF/RN: RF-20..23, RN-59..68/117, PM-19..22, API_CONTRACT.md §2/§3.
- Trabajo realizado: `incident-lifecycle.mts` con creación en ABIERTA y expediente PENDIENTE, transición única ABIERTA→EN_ANALISIS→CERRADA, cierre que exige resolución no vacía y expediente SINCRONIZADO, bloqueo de reapertura y de edición de expediente cerrado. Sin evento Mongo de cierre y sin liberación de bloqueos (RN-96/117). DOC-06 sigue PENDING: faltan repositorio SQL, controlador NestJS e idempotencia HTTP de I-1.
- Archivos modificados: `backend/src/modules/incidents/incident-lifecycle.mts`, `backend/src/modules/incidents/incident-lifecycle.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: código en `feature/mongo-schema`, commit `0f77a5f`; PR pendiente, sin integrar en `develop`. No se borró nada.
- Pruebas reales: suite conjunta inspections + quality + dossier + lifecycle → 51/51 OK (2026-11-26). PM-19..22 y lint/typecheck/build: NOT_RUN (sin MongoDB ni dependencias).
- Bloqueadores/dependencias/decisiones: B-001 abierto (BASE-01/02 de I-1); BASE-05 sin contratos; `.mts` por `backend/package.json` vacío (AI-15 reportado); D-002 pendiente de ratificación.
- Próxima acción concreta: DOC-07 (bloqueo y liberación con verificación de grafo) según el plan; requiere `verifyDescendant` de I-3, por lo que se preparará la lógica pura con puertos inyectados y sus pruebas sin invadir módulos ajenos.

### TC-SESSION-20261126-I2-007
- Fecha: 2026-11-26. Responsable: I-2 (rama `feature/mongo-schema`; punto de control en `docs/incorporar-reglas-i2`).
- Objetivo: completar el orden del plan para las tareas propias de I-2 — DOC-07, DOC-08 y DOC-09.
- RF/RN: DOC-07 RF-31/32, RN-87..96/118, TP-17, PI-08; DOC-08 RF-16/17, RN-51..54/115; DOC-09 RF-20..23/31/32, RN-11/87/96/117, RNF-15/16.
- Trabajo realizado: `block-service.mts` con verificación `YES/NO/UNKNOWN` inyectada, raíz sin Neo, 1..100 lotes distintos, todo o nada, `BLOCK_ALREADY_ACTIVE`, retiro individual con motivo, cierre sin liberación y `ReleaseResult`; `inspection-form.mts` con descriptores derivados de la plantilla y conversión ENTERO/DECIMAL/BOOLEANO; `incident-view.mts` con acciones por rol y estado, etiquetas en español y confirmaciones. Ninguna suites usa mocks fuera de pruebas aisladas.
- Archivos modificados: `backend/src/modules/lot-blocks/**`, `frontend/src/features/inspections/**`, `frontend/src/features/incidents/**`, `PROGRESS.md`.
- Rama/commit/PR: `beb3e88`, `4830165`, `6772185`; PR pendiente, sin integrar en `develop`. No se borró nada.
- Pruebas reales: 78/78 OK (suite conjunta de siete archivos, 2026-11-26). PM-13/PM-17..22/PM-19, TP-17, PI-08, E2E y lint/typecheck/build: NOT_RUN (sin MongoDB, NestJS ni dependencias instaladas).
- Bloqueadores/dependencias/decisiones: B-001 abierto (BASE-01/02 de I-1); BASE-04/BASE-05 sin contratos ni componentes; `.mts` por `package.json` vacíos (AI-15 reportado); D-002 pendiente de ratificación.
- Próxima acción concreta: TEST-02 (evidencia documental y matriz RF/RN) y el apoyo de I-2 en DEMO-01/02, condicionados a infraestructura real. No se inicia benchmark ni se afirma superioridad de Neo4j.

### TC-SESSION-20261126-I2-008
- Fecha: 2026-11-26. Responsable: I-2 (código en `feature/mongo-schema`; punto de control en `docs/incorporar-reglas-i2`).
- Objetivo: cerrar todo el alcance de I-2 que no depende de otros roles — consolidación documental y matriz RF/RN de TEST-02.
- RF/RN: RNF-18/20, AI-14, área `docs/ consolidación` de AGENTS §3; sin RF/RN nuevos.
- Trabajo realizado: `docs/fuente-de-verdad.md`, `docs/arquitectura.md`, `docs/decisiones-tecnologicas.md`, `docs/modelos/document/modelo-documental.md` y `docs/pruebas/matriz-trazabilidad.md`. La matriz vincula RF/RN con los nueve artefactos de I-2 y sus pruebas, declara PM/TP/PI/E2E como NOT_RUN y registra comandos y resultados reales. No se modificaron contratos ni documentos base.
- Archivos modificados: los cinco documentos derivados anteriores y `PROGRESS.md`.
- Rama/commit/PR: documentación en `feature/mongo-schema`, commit `7f51147`; punto de control en rama docs. PR pendiente; sin merge a `develop`. No se borró nada.
- Pruebas reales: sin cambios de código en esta sesión. Última ejecución vigente: 309 verificaciones estáticas y 78/78 pruebas unitarias (2026-11-26). PM-01..23, TP-17, PI-08, E2E, lint/typecheck/build: NOT_RUN.
- Bloqueadores/dependencias/decisiones: B-001 abierto; BASE-01/02/04/05 y D-002 pendientes; `develop` recibió el commit ajeno `130868b` con los siete documentos (seis byte-idénticos a los nuestros, `PROGRESS.md` distinto). Reportado según AI-15; sin merge, rebase ni borrado.
- Cierre de alcance independiente: DOC-01..DOC-09 y la preparación de TEST-02 están listos en forma de lógica pura, artefactos y documentación; el avance formal permanece en 0 % hasta verificación e integración con evidencia.

### TC-SESSION-20261126-I2-009
- Fecha: 2026-11-26. Responsable: I-2 (rama `feature/mongo-integration-bridge`, creada desde `develop` integrado).
- Objetivo: ayudar a I-1 únicamente en el puente que conecta su bootstrap con los módulos de I-2, sin tocar módulos relacionales, de infraestructura ni de grafos.
- RF/RN: RNF-18/20, AI-14/AI-15; sin RF/RN nuevos ni cambios de contrato.
- Trabajo realizado: `docs/integracion-i1-i2.md` con el entrego exacto (BASE-01/02/05/06, variables de entorno, puertos y orden de verificación) y `backend/src/database/mongodb/adapters.mts` con `createMongoDossierStore` y `createMongoQualityPorts` sobre una interfaz `MongoLikeDb` inyectable, mapeadores camelCase ↔ snake_case español y `Date` ↔ ISO, CAS sin `_id` en `$set` y manejo de UQ(11000). Se corrigieron marcadores de conflicto sin resolver en `PROGRESS.md` (se conservó la versión rica de I-2; la versión obsoleta sigue en el historial de Git).
- Archivos modificados: `docs/integracion-i1-i2.md`, `backend/src/database/mongodb/adapters.mts`, `backend/src/database/mongodb/adapters.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: `feature/mongo-integration-bridge`; PR pendiente, sin integrar. No se borró código ajeno ni se hicieron merges en esta sesión.
- Pruebas reales: `node --experimental-strip-types --test <8 suites>` → 84/84 OK (78 anteriores + 6 del adaptador), 2026-11-26. `static-check.mjs` → 309 verificaciones OK en la rama integrada. PM-01..23, lint/typecheck/build: NOT_RUN (sin BASE-01/02 ni dependencias).
- Bloqueadores/dependencias/decisiones: B-001 abierto; I-1 debe habilitar workspaces, Docker/Mongo y `packages/contracts`; I-3 debe proveer `verifyDescendant`; D-002 pendiente de ratificación. El adaptador usa una interfaz estructural para evitar importar el driver hasta que BASE-01 exista (AI-15 reportado).
- Próxima acción concreta: que I-1 integre esta rama cuando corresponda y, tras BASE-02, ejecutar validadores/índices/plantillas y conectar `client.db(...)` a estos adaptadores para correr PM-01..23.

### TC-SESSION-20261126-I1-001
- Fecha: 2026-11-26. Responsable: I-1 (rama `feature/pg-bootstrap`).
- Objetivo: BASE-01 y BASE-02 — bootstrap del monorepo, validación de entorno e infraestructura Docker.
- RF/RN: RNF-07, RNF-19, PROJECT §5/§6; sin RF/RN nuevos.
- Metodología TDD: se escribió `tests/unit/bootstrap.spec.mts` primero; fase roja por módulo ausente; después se implementaron los manifiestos y `env.validation.mts`; fase verde 9/9. Un fallo intermedio era un falso positivo de substring en la aserción (`0` dentro de `20`), corregido buscando el valor como token completo, sin debilitar la regla de no exposición de valores.
- Archivos modificados: `package.json`, `backend/package.json`, `frontend/package.json`, `packages/contracts/package.json`, `tsconfig.base.json`, `backend/tsconfig.json`, `frontend/tsconfig.json`, `packages/contracts/tsconfig.json`, `.nvmrc`, `.editorconfig`, `.prettierrc.json`, `eslint.config.mjs`, `.env.example`, `docker-compose.yml`, `.github/workflows/ci.yml`, `backend/src/config/env.validation.mts`, `tests/unit/bootstrap.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: `feature/pg-bootstrap`; PR pendiente, sin integrar en `develop`. No se borró nada.
- Pruebas reales: `node --experimental-strip-types --test tests/unit/bootstrap.spec.mts` → 9/9 OK. Las 84 pruebas de I-2 y las 309 verificaciones estáticas siguen pasando en `develop`. `npm ci`, lint, typecheck, build y pruebas de motores: NOT_RUN (sin dependencias instaladas ni contenedores).
- Bloqueadores/dependencias/decisiones: B-001 abierto; BASE-05 requiere coordinación del equipo; D-002 pendiente de ratificación. La validación falla explícitamente sin exponer secretos (AI-16).
- Próxima acción concreta: BASE-05 (tipos compartidos mínimos) y REL-01 (esquema relacional con 16 tablas + `schema_migrations`), siempre con prueba previa.

### TC-SESSION-20261126-I1-002
- Fecha: 2026-11-26. Responsable: I-1 (rama `feature/pg-bootstrap`).
- Objetivo: REL-01 — esquema relacional versionado (16 tablas + `schema_migrations`).
- RF/RN: RNF-08/RNF-09, DATA_MODEL.md §2, RN-25/28/40/48/92/101; AI-09.
- Metodología TDD: `tests/unit/relational-schema.spec.mts` primero (fase roja por archivos ausentes); después siete migraciones y el ejecutor checksum; fase verde 7/7.
- Archivos modificados: `database/relational/schema/001_catalogs.sql` … `007_views_indexes.sql`, `database/relational/migrate.mjs`, `tests/unit/relational-schema.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: `feature/pg-bootstrap`; PR pendiente, sin integrar. No se borró nada.
- Pruebas reales: 7/7 verificaciones estructurales del esquema; 9/9 del bootstrap; 84/84 y 309/309 de I-2 siguen pasando en `develop`. Migraciones contra PostgreSQL real: NOT_RUN (sin contenedor).
- Bloqueadores/dependencias/decisiones: B-001 abierto; `npm ci` y Docker pendientes; BASE-05 sin contratos compartidos. FKs añadidas en orden para evitar ciclos (movimientos → orden/distribución); sin ON DELETE CASCADE.
- Próxima acción concreta: REL-02/03 y REL-06 con estrategia TDD: lectores y repositorios SQL, `TransactionManager`, lock order, stock atómico, outbox e idempotencia.

### TC-SESSION-20261126-I1-003
- Fecha: 2026-11-26. Responsable: I-1 (rama `feature/pg-bootstrap`).
- Objetivo: REL-02/REL-06 parcial — transacciones, locks ordenados, stock exacto, outbox e idempotencia.
- RF/RN: RNF-08/RNF-09, RN-25/28/101/119/120; AGENTS §2 (misma transacción SQL y locks ordenados).
- Metodología TDD: `tests/unit/transactional-repositories.spec.mts` primero (roja por módulo ausente), después `transaction.mts`; verde 7/7. Un fallo era de la prueba (excepción síncrona no capturada por `assert.rejects`), corregido envolviendo la llamada en función asíncrona.
- Trabajo realizado: `createTransactionManager` (BEGIN/COMMIT/ROLLBACK/release), `lockLots` con `ORDER BY id ... FOR UPDATE`, `changeStock` con aritmética Decimal en BigInt (3 decimales, sin float) y movimiento en la misma transacción, `createOutboxWriter` con `payloadVersion: 1`, e `createIdempotencyStore` con replay y `IDEMPOTENCY_CONFLICT`. Las interfaces son estructurales para inyectar un `PoolClient` real.
- Archivos modificados: `backend/src/database/postgres/transaction.mts`, `tests/unit/transactional-repositories.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: `feature/pg-bootstrap`; PR pendiente, sin integrar. No se borró nada.
- Pruebas reales: 7/7 transaccionales; 9/9 bootstrap; 7/7 esquema; 84/84 y 309/309 de I-2 siguen verdes en `develop`. Contra PostgreSQL real: NOT_RUN.
- Bloqueadores/dependencias/decisiones: B-001 abierto; BASE-05 sin contratos; D-002 pendiente. Sin transacción distribuida: I/O de Mongo/Neo queda fuera de la transacción SQL (AGENTS §2).
- Próxima acción concreta: completar REL-03 (repositorios de incidencia/bloqueo con versión confirmada), REL-04 (auth Argon2id/JWT/roles) y los casos de uso REL-05..11, manteniendo TDD.

### TC-SESSION-20261126-I1-004
- Fecha: 2026-11-26. Responsable: I-1 (rama `feature/pg-incident-auth`).
- Objetivo: REL-03 y REL-04 — repositorios SQL de incidencias/bloqueos y autenticación/autorización.
- RF/RN: RF-01/RF-02/RF-20..23/RF-31/32, RNF-04/05, RN-07/08/11/63/64/92/116/117/125, PS-01..12.
- Metodología TDD: `tests/unit/incident-auth.spec.mts` primero (roja), después ambos módulos; verde 10/10. Un fallo de sintaxis por *parameter property* de TypeScript en modo strip-only se corrigió con asignación explícita en `AuthError`.
- Trabajo realizado: `incident-repositories.mts` con create/find/lock, versión confirmada derivada de eventos COMPLETADOS, start/close con WHERE de estado y repositorio de bloqueos con createMany/release/activeByLots; `auth.mts` con JWT HS256 (claims iss/aud/iat/exp), verificación con timingSafeEqual, RBAC y límite de 5 intentos por IP/60 s. Argon2id queda como puerto inyectado hasta que BASE-01 instale dependencias.
- Archivos modificados: `backend/src/database/postgres/incident-repositories.mts`, `backend/src/modules/auth/auth.mts`, `tests/unit/incident-auth.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: `feature/pg-incident-auth`; PR pendiente, sin integrar. No se borró nada.
- Pruebas reales: 10/10 incidencias/auth; 23/23 de las suites I-1 anteriores y 84/84 de I-2 permanecen verdes en `develop`. Base de datos real: NOT_RUN.
- Bloqueadores/dependencias/decisiones: B-001 abierto; BASE-05 sin contratos; D-002 pendiente. Contraseñas nunca en texto plano; errores sin exponer secretos (AI-16).
- Próxima acción concreta: REL-05/07/08/09/10/11 con TDD: catálogos, recepciones, producción, distribución, dashboard y detalle integrado, reutilizando `InventoryWriter`, `OutboxWriter` e idempotencia.

### TC-SESSION-20261126-I1-005
- Fecha: 2026-11-26. Responsable: I-1 (rama `feature/pg-use-cases`).
- Objetivo: REL-05/07/08/09 — catálogos, recepción, producción y distribución como casos de uso orquestados.
- RF/RN: RF-04/05/06/07/11/12/14, RN-12..48/110/112/113, RNF-08/09.
- Metodología TDD: `tests/unit/operations.spec.mts` primero (roja), después `operations.mts`; verde 9/9. Dos fallos propios corregidos: `lotId` vs `loteId` en el shorthand, y una aserción que esperaba el envelope del outbox en el doble (el envoltorio lo aplica `OutboxWriter`, no el caso de uso).
- Trabajo realizado: validación de códigos/cantidades, `crearProveedor`, `registrarRecepcion` (catálogo activo, idempotencia, stock + outbox en transacción), `registrarProduccion` (1..50 entradas, 1..20 salidas, locks ordenados, dependencias completas) y `registrarDistribucion` (salida/entrada por ítem, mismo ID de lote), todos reutilizando `InventoryWriter`, `OutboxWriter` e idempotencia.
- Archivos modificados: `backend/src/modules/operations/operations.mts`, `tests/unit/operations.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: `feature/pg-use-cases`; PR pendiente, sin integrar. No se borró nada.
- Pruebas reales: 9/9 operaciones; 33/33 de I-1 previas y 84/84 de I-2 permanecen verdes en `develop`. PostgreSQL real: NOT_RUN.
- Bloqueadores/dependencias/decisiones: B-001 abierto; BASE-05 sin contratos; D-002 pendiente. Los catálogos inactivos rechazan operación (INACTIVE_RESOURCE); sin mocks en aplicación integrada.
- Próxima acción concreta: REL-10/11 (dashboard y detalle de lote) e interfaces frontend de I-1, con TDD.

### TC-SESSION-20261126-I1-006
- Fecha: 2026-11-26. Responsable: I-1 (rama `feature/pg-dashboard`).
- Objetivo: REL-10/REL-11 únicamente — dashboard API y detalle integrado de lote. Por decisión del equipo no se tocan interfaces frontend en este avance.
- RF/RN: RF-03/RF-09, RNF-13, RN-124, QP-15/QI-01, API_CONTRACT.md §3/§4.
- Metodología TDD: `tests/unit/dashboard.spec.mts` primero (roja), después `dashboard.mts`; verde 6/6.
- Trabajo realizado: `createDashboardService` con cuatro conteos paralelos, actividad reciente validada 1..50 y estado del sistema delegado; `createLotDetailsService` con composición de stocks/calidad/genealogía/incidencias/bloqueos, `maxDepth` 1..20, `RESOURCE_NOT_FOUND` para lote ausente y secciones `NO_DISPONIBLE`/estado global `PARCIAL` cuando falla una fuente secundaria, sin convertir errores en ceros.
- Archivos modificados: `backend/src/modules/dashboard/dashboard.mts`, `tests/unit/dashboard.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: `feature/pg-dashboard`; PR pendiente, sin integrar. No se borró nada.
- Pruebas reales: 6/6 dashboard/detalle; 42/42 de I-1 previas y 84/84 de I-2 permanecen verdes en `develop`. Motores reales: NOT_RUN.
- Bloqueadores/dependencias/decisiones: B-001 abierto; BASE-05 sin contratos; D-002 pendiente. Las interfaces frontend de I-1 quedan pospuestas por instrucción del equipo.
- Próxima acción concreta: integración de esta rama por parte del equipo y, cuando exista infraestructura, conectar estos servicios a lectores reales y ejecutar PM/TP/PI/E2E.

### TC-SESSION-20261126-I3-001
- Fecha: 2026-11-26. Responsable: I-3 (rama `feature/graph-schema`, base `f82fd16`).
- Objetivo: punto de control previo a GRA-01 — verificar repositorio, dependencias, contratos, pruebas existentes y disponibilidad real de PostgreSQL/MongoDB/Neo4j, sin iniciar frontend.
- RF/RN: preparación de RF-26..30/RF-33, RNF-07/10 y PG-01..21; ningún RF/RN ni contrato fue modificado.
- Trabajo realizado y estado: se leyeron los siete documentos base; se inspeccionaron rama, historial, estado, código, pruebas, `database/graph/**`, configuración y ramas remotas. Se creó la rama desde `develop`; GRA-01 permanece PENDING/BLOCKED porque BASE-05 no existe y BASE-02 no está verificada. Se confirmó que `packages/contracts/` solo contiene configuración, sin `src`, y que ninguna rama remota aporta esos contratos. Frontend/BASE-04/Cytoscape.js/UX quedan fuera de esta fase.
- Archivos modificados: `PROGRESS.md` únicamente. No se modificaron migraciones, contratos, esquema Neo4j, dependencias, backend ajeno ni frontend.
- Pruebas reales: `node --experimental-strip-types --test <tests/unit/*.spec.mts + backend/src/**/*.spec.mts>` con Node v24.21.0 → 119/119 OK el 2026-11-26. `git status --short --branch` confirmó `develop...origin/develop` limpio antes de crear la rama. El primer arranque aislado `docker compose -p tracechain_i3_test up -d postgres mongodb neo4j` fue cancelado por reinicio del servidor y no produjo evidencia; Docker Desktop se inició después con su ejecutable principal y `docker info --format '{{.ServerVersion}}'` → `29.9.2`. El segundo arranque descargó Neo4j/MongoDB y dejó ambos healthy; PostgreSQL no pudo publicar `127.0.0.1:5432` porque un proceso PostgreSQL local ajeno (PID 9276) ya escucha ese puerto. Sin detenerlo ni editar Compose, se inició PostgreSQL con `docker compose ... run -d --no-deps` sin puerto de host. Resultado final: `pg_isready` accepting connections y `SELECT 1` → `1`; MongoDB `db.adminCommand({ping:1})` → `{"ok":1}`; Neo4j `RETURN 1 AS ok` → `1`; los tres contenedores healthy. Migraciones de aplicación, `npm ci`, lint, typecheck, build, PG/PI/E2E/QE/DA: NOT_RUN.
- Bloqueadores/dependencias/decisiones: B-004 abierto solo por dependencias formales/contratos, no por disponibilidad de motores. Entorno adicional: no hay `package-lock.json` ni `node_modules`; `.nvmrc` exige Node 22, pero el host tiene Node 24.21.0/npm 11.19.0 y no dispone de `nvm`. No se detuvo el PostgreSQL local, no se instalaron herramientas ni se cambiaron archivos de I-1.
- Próxima acción concreta: equipo implementa y revisa BASE-05; I-1 verifica BASE-02. I-3 vuelve a comprobar contratos y salud real (`SELECT 1`, Mongo `ping`, Neo4j `RETURN 1`), cambia GRA-01 a `IN_PROGRESS` solo si ambas dependencias quedan satisfechas e implementa las 6 etiquetas/7 relaciones con sus pruebas oficiales.

### TC-SESSION-20261126-I1-007
- Fecha: 2026-11-26. Responsable: I-1 (rama `feature/pg-base05-contracts`).
- Objetivo: completar BASE-05 en `packages/contracts/src/` según `API_CONTRACT.md` y preparar la validación formal de BASE-02 sin detener PostgreSQL local.
- RF/RN: RNF-18/19, AI-03/AI-19/AI-20; contratos exactos de `API_CONTRACT.md` §2/§4/§6/§7/§8.
- Metodología TDD: `tests/unit/contracts.spec.mts` primero (roja), después `common.ts`, `dto.ts`, `events.ts`, `interfaces.ts` e `index.ts`; verde 4/4. `tests/unit/base02-validation.spec.mts` primero (roja), después `docker-compose.test.yml` y `tests/integration/engines-smoke.mjs`; verde 3/3.
- Trabajo realizado: tipos compartidos (UUID, Instant, CivilDate, Quantity, DecimalString, Count), enums/códigos oficiales (36 errores, 10 advertencias, 9 eventos), DTO y lecturas, `TraceabilityReader`/`TraceResult`/`CommonOriginsRequest`/`PathsRequest`, `EventEnvelope`/`EventPayloadMap`/`EventHandler` y eventos Neo4j, interfaces DI y exportaciones desde `index.ts`. Se corrigió la importación de `EventType` (está en `common.ts`, no en `events.ts`) para satisfacer `tsc --strict`. Se generó `package-lock.json` con Node 22.22.3 / npm 10.9.8.
- Verificaciones de contratos: `npm run typecheck --workspace @tracechain/contracts` → exit 0; `npm run build --workspace @tracechain/contracts` → exit 0; dist con 10 artefactos (.js/.d.ts); `npm ci --dry-run` → exit 0; lockfileVersion 3 con 747 entradas. `npm ci` real quedó en ejecución al registrar este punto; su resultado se añadirá cuando termine.
- BASE-02: `docker-compose.test.yml` publica PostgreSQL en `127.0.0.1:55432:5432` para no interferir con el servicio local en 5432; no se detuvo ningún servicio. Smoke de los tres motores preparado, pendiente de ejecutar con contenedores arriba.
- Archivos modificados: `packages/contracts/src/**`, `packages/contracts/tsconfig.json`, `package.json` (typescript-eslint 8.74.0 por peer de TS 5.9), `package-lock.json`, `docker-compose.test.yml`, `tests/integration/engines-smoke.mjs`, `tests/unit/contracts.spec.mts`, `tests/unit/base02-validation.spec.mts`, `PROGRESS.md`.
- Rama/commit/PR: `feature/pg-base05-contracts`; PR pendiente, sin integrar. No se borró nada.
- Bloqueadores/dependencias/decisiones: B-001 abierto hasta ejecutar migraciones y motores; D-002 pendiente. El informe del equipo sobre "pruebas reales de los tres motores" no tiene evidencia versionada en el repo; el puerto 5432 estaba libre en esta máquina, pero el override evita cualquier conflicto. Advertencias de `npm audit` reportadas, sin aplicar `audit fix --force` por ser cambios rupturistas (AI-20).
- Próxima acción concreta: confirmar `npm ci`, arrancar motores con el override y ejecutar el smoke; después integrar rama y actualizar estados formales solo con evidencia.

### TC-SESSION-20261126-I3-002
- Fecha: 2026-11-26. Responsable: I-3 (rama `feature/graph-schema`).
- Objetivo: integrar BASE-05/02, corregir con autorización los defectos de infraestructura encontrados y ejecutar GRA-01 con TDD sobre Neo4j real.
- RF/RN: RF-33, RNF-07/11/18/19; DATA_MODEL §4; AI-03/14/15/18/19. Sin cambios de contrato, etiquetas o relaciones fuera de las seis/siete oficiales.
- Trabajo realizado y estado: merge de `origin/develop` (`87206c5`) conservando completas las sesiones I-1/I-3 de `PROGRESS.md`; se detectó que Compose combinaba 5432 y 55432. Con autorización del dueño se añadió `!override` y una regresión que exige reemplazo real. También se corrigió el import CommonJS de `pg` en el smoke. GRA-01 se implementó con tres scripts numerados, aplicador idempotente y pruebas estática/integración. Estado PENDING/BLOCKED → VERIFIED localmente; PR/merge pendientes.
- Archivos modificados: `docker-compose.test.yml`, `tests/unit/base02-validation.spec.mts`, `tests/integration/engines-smoke.mjs`, `database/graph/apply-schema.mjs`, `database/graph/schema/001_node_constraints.cypher`, `002_relationship_constraints.cypher`, `003_indexes.cypher`, `database/graph/tests/schema.spec.mts`, `schema.integration.mjs`, `PROGRESS.md`.
- Pruebas reales: configuración Compose combinada confirmó solo `127.0.0.1:55432→5432`; BASE-02/contratos 7/7; smoke oficial `node tests/integration/engines-smoke.mjs` con Node 22.22.0 → PostgreSQL/MongoDB/Neo4j OK, 3/3; `npm ci` con npm 10.9.4 → exit 0, 665 paquetes; contratos `typecheck` y `build` → exit 0. TDD GRA-01: `node --experimental-strip-types --test database/graph/tests/schema.spec.mts` rojo 0/4 por archivos ausentes, luego verde 4/4. Aplicador ejecutado dos veces → exit 0 en ambas. `node --test database/graph/tests/schema.integration.mjs` contra Neo4j 5.26 Community → 2/2: 13 constraints oficiales y 6 índices ONLINE.
- Fallos conservados: el primer `npm ci` excedió 120 s y una ejecución concurrente produjo `ENOTEMPTY`; se retiró solo el contenedor/volumen temporal propio y la ejecución limpia terminó correctamente. `npm run typecheck` global FALLÓ en imports `.mts` y errores de tipos preexistentes en `dossier.mts`/`operations.mts`; frontend también falla por imports `.mts`. Build global NOT_RUN porque el comando usaba `&&`. Auditoría npm reportó 19 vulnerabilidades (2 low, 2 moderate, 12 high, 3 critical); no se ejecutó `audit fix --force`.
- Bloqueadores/dependencias/decisiones: B-004 resuelto; B-005 abierto y asignado a dueños de módulos. GRA-02 depende además de REL-06 y no se inicia unilateralmente. Frontend sigue fuera de alcance.
- Rama/commit/PR: merge local `55736f5`; corrección de puerto `ede63a8`; commit de GRA-01 pendiente al registrar esta entrada; PR pendiente.
- Próxima acción concreta: commit de GRA-01 y solicitud de revisión; después coordinar evidencia/estado real de REL-06 para iniciar handlers GRA-02.

### TC-SESSION-20261126-I3-003
- Fecha: 2026-11-26. Responsable: I-3 (rama `feature/graph-schema`, PR #9).
- Objetivo: corregir el fallo de lint CI del PR sin desactivar lint ni adelantar frontend visual (RNF-18/19, AI-12/18).
- Trabajo realizado: se comprobó que `frontend/src` contiene cuatro archivos `.mts` pero el script buscaba solo `.ts/.tsx` y ESLint ignoraba `.mts`. Se incluyó `.mts` en `frontend/package.json` y se retiró la exclusión global del tipo en `eslint.config.mjs`; queda pendiente revisión del coordinador I-1 para esa configuración.
- Archivos: `frontend/package.json`, `eslint.config.mjs`, `PROGRESS.md`. Ningún componente ni contrato modificado.
- Pruebas reales: Docker `node:22.22.0-bookworm` (npm 10.9.4, dependencias instaladas): `npm run lint` → exit 0 el 2026-11-26. `npm run typecheck` → exit 1: TS5097 en imports `.mts` de módulos backend/frontend; TS2352 en `backend/src/modules/incidents/dossier.mts:211`; TS2339 en `backend/src/modules/operations/operations.mts:115`. Contratos sí pasan. Build/test/integración: NOT_RUN en esta corrección (no ocultar fallo).
- Bloqueos y siguiente acción: B-005 sigue abierto; I-1 revisa configuración y corrige `operations.mts`, I-2 coordina módulos `.mts`/dossier y frontend de sus features. Repetir CI y solicitar revisión humana antes de merge; no afirmar PR verde por el éxito aislado de lint.

### TC-SESSION-20261126-I3-004
- Fecha: 2026-11-26. Responsable: I-3 (rama `feature/graph-schema`, PR #9); corrección de código I-1/I-2 autorizada explícitamente por el equipo.
- Objetivo: resolver TS5097/TS2352/TS2339 del typecheck CI sin omitir archivos, pruebas o validaciones (RNF-18/19, AI-11/12/18/19).
- Cambios: `backend/tsconfig.json` reescribe extensiones relativas `.mts` durante emisión (`.mjs`), `frontend/tsconfig.json` acepta imports `.mts` al no emitir; reserva idempotente usa unión discriminada `replay: false | true` en puerto y consumidor; el patch del expediente copia campos mutables tipados y asigna fechas de servidor a evidencias antes de validar, sin cast a `Record<string, unknown>`. No se modificaron contratos compartidos ni frontend visual.
- Archivos: `backend/tsconfig.json`, `frontend/tsconfig.json`, `backend/src/database/postgres/transaction.mts`, `backend/src/modules/operations/operations.mts`, `backend/src/modules/incidents/dossier.mts`, `PROGRESS.md`.
- Pruebas reales: Docker `node:22.22.0-bookworm`, npm 10.9.4: `npm run typecheck` → exit 0 en backend/frontend/contratos; `npm run lint` → exit 0; `node --experimental-strip-types --test <tests/unit + backend/src + frontend/src + database/graph/tests/*.spec.mts>` con Node local 24.21.0 → 143/143 OK. `npm run test` → exit 0, pero Jest backend encuentra 0 pruebas y Vitest reporta 2 archivos/0 pruebas propias (las aserciones `node:test` se imprimen por separado); no confundir con 143/143. `npm run build` → exit 1: backend y contratos compilan, frontend falla porque Next.js no encuentra `pages` ni `app`. `npm run test:integration` → exit 1: falta `backend/test/jest-integration.json`. No se ejecutó prueba de integración de tres motores en esta corrección; consta smoke real anterior.
- Bloqueos y siguiente acción: B-005 resuelto localmente, B-006/B-007 abiertos; I-1/I-2 revisan sus archivos en PR, I-3 no inicia BASE-04 sin autorización de alcance y I-1 coordina harness de integración. No merge hasta revisión humana y CI con evidencia.

### TC-SESSION-20261126-I3-005
- Fecha: 2026-11-26. Responsable: I-3 (rama `feature/graph-schema`, PR #9), con autorización del equipo para corregir CI/harness de I-1.
- Objetivo: sustituir el `test:integration` roto por pruebas ejecutables y reales (RNF-07/18/19; AI-12/18); evaluar bloqueo de `next build` sin ocultarlo.
- Alcance: el usuario rechazó expresamente iniciar frontend. No se crearon `app/`, `pages/`, pantallas falsas ni excepciones para saltar el build. B-006 permanece abierto.
- Cambios: `backend/test/jest-integration.json` y `engines.integration.cjs` ejecutan tres verificaciones reales en PostgreSQL, MongoDB y Neo4j, comprobando constraints/índices ONLINE. `backend/package.json` ejecuta smoke, esquema idempotente y Jest sin `--passWithNoTests`. `.github/workflows/ci.yml` genera credenciales efímeras solo en el runner, inicia motores aislados con override de puerto `55432`, corre integración antes de build y detiene contenedores al terminar. No se cambió ningún contrato compartido.
- Verificaciones reales: en Docker Node 22.22.0/npm 10.9.4 con PostgreSQL 16, MongoDB 8 y Neo4j 5.26 healthy: `npm run test:integration` → exit 0, smoke 3/3, aplicador Neo4j 3 scripts, Jest 3/3; `npm run lint`, `npm run typecheck`, `npm run test` → exit 0 (Jest unitario aún encuentra cero suites; Vitest 2 archivos con aserciones `node:test`, informa 0 pruebas propias). Build global: FALLÓ previamente por falta de ruta Next.js; no repetido al no cambiar frontend. CI de GitHub tras este cambio: NOT_RUN hasta push y ejecución real.
- Bloqueadores y próxima acción: B-007 resuelto localmente, B-006 sigue bloqueando merge según instrucción del usuario; I-1 revisa cambios de CI/backend, I-3 no declara BASE-04 terminada. PR no se debe fusionar hasta revisión humana y acuerdo sobre el build frontend.

### TC-SESSION-20261126-I3-006
- I-3 con autorización para la parte Outbox de REL-06 (RF-33/RN-120), rama `feature/pg-outbox-dispatcher`. El escritor conserva el UUID y serializa secuencias. `backend/src/integration/outbox/dispatcher.mts` expone `dispatchNext` y `runOutbox`: lock de sesión por destino, entrega fuera de transacción, ACK y estado documental atómicos, fallo permanente o backoff transitorio. El adaptador recibe `AbortSignal` y debe cancelar la operación de destino al vencimiento.
- Node 22 en Docker: `npm run typecheck`, build backend, lint y 7/7 unitarias transaccionales OK. `npm run test:integration`: smoke 3/3, prueba RN-120 y Jest 3/3. Primer intento detectó SQLSTATE 42P08 en el ACK; corregido con tipo explícito. La prueba RN-120 ampliada pasó en esquema PostgreSQL aislado: exclusión concurrente, bloqueo de cabeza fallida, recuperación tras fallo del ACK con el mismo UUID, rechazo de versión y avance independiente del estado documental. El callback de prueba registra las entregas; esto no verifica aún una proyección GRA-02.
- Siguiente: revisión de I-1, registrar adaptadores reales y conectar `runOutbox` al ciclo de vida/configuración del backend. La idempotencia de solicitudes de negocio de REL-06 sigue usando memoria en `createIdempotencyStore`; no se verifica REL-06 completa. Sin cambios de frontend.

### TC-SESSION-20261126-I3-007
- Fecha: 2026-11-26. Responsable: I-3 (rama `docs/graph-integration-checkpoint`, basada en `origin/develop` `9d5f196`).
- Objetivo: verificar integración de PR #9/#10 y dependencias reales de GRA-02 antes de modificar contratos o módulos ajenos (AI-01/02/14/15/18/20).
- Evidencia observada: Git y API GitHub confirman PR #9 fusionado (`b0e6894`) y PR #10 fusionado (`9d5f196`). La consulta única de check-runs para `9d5f196` devolvió `verify: in_progress`; resultado final no verificado, no se declara verde.
- Estado: GRA-01 VERIFIED → MERGED por evidencia de PR. REL-06 conserva dispatcher con prueba real, pero el arranque de NestJS (`main.ts`, `app.module.ts`) está vacío, no existen adaptadores registrados de ambos destinos y `createIdempotencyStore` sigue usando memoria. GRA-02 permanece PENDING hasta acordar y verificar integración I-1/I-2; frontend sigue pospuesto.
- Archivos modificados: `PROGRESS.md` únicamente. Pruebas de código en esta sesión: NOT_RUN (inspección Git/GitHub/código); no reinterpretar pruebas locales de sesiones anteriores como CI confirmado.
- Próxima acción concreta: obtener acuerdo de I-1/I-2 para completar bootstrap, persistencia de idempotencia y handler Mongo, ejecutar CI e integración completa y entonces iniciar GRA-02 en rama nueva.

### TC-SESSION-20261126-I3-008
- Fecha: 2026-11-26. Responsable: I-3; rama `feature/graph-outbox-integration` desde `origin/develop` `9d5f196` más checkpoint documental `f4312de`; código en commit `87982fe`. Autorización explícita de I-1/I-2 comunicada por el usuario para tocar bootstrap/SQL/Mongo; revisión humana sigue pendiente.
- Objetivo: REL-06 parcial y GRA-02 parcial; RF-33/34, RN-101..104/116/119/120, PG-01..04, PM-12/15/16, PI-11/12. Sin ampliar tablas, etiquetas, contratos REST ni frontend.
- Implementado: idempotencia SQL sin `Map`, reserva transaccional y respuesta 2xx en el mismo commit que el outbox de los casos de uso operativos; handlers de eventos Neo catálogo/recepción/producción con MERGE y rollback por extremo faltante; handler Mongo expediente con inserción única y CAS; dos bucles `runOutbox` conectados a los hooks NestJS con apagado y cancelación; arranque de backend. Pruebas de integración aisladas añadidas para concurrencia/rollback SQL, proyección Neo, CAS Mongo y arranque de ambos consumidores con ACK SQL. No hay API REST funcional añadida.
- Verificaciones locales reales en Docker Node 22.22.0/npm 10.9.4 y motores de pruebas PostgreSQL 16/MongoDB 8/Neo4j 5.26: `npm run typecheck`, `npm run lint`, `npm run build --workspace backend` OK; `node --experimental-strip-types --test tests/unit/*.spec.mts backend/src/modules/**/*.spec.mts backend/src/database/mongodb/*.spec.mts` → 126/126 OK; lint explícito de archivos `.mts`/`.mjs` modificados OK (el primer intento detectó globals de Node no importados en test runtime, corregido). `npm run test:integration` tuvo un primer fallo por import nombrado CommonJS `pg`, corregido y repetido: exit 0; smoke 3/3, pruebas Node 2+2+1 OK, Jest 3/3, compilación backend OK. `npm run test` exit 0 pero Jest backend encuentra cero suites y Vitest informa cero tests propios; no sustituye la ejecución directa de las 126 pruebas. `npm run build` exit 1: Next.js sin `app/`/`pages/` (BASE-04 pospuesta expresamente). CI de esta rama NOT_RUN.
- Límites conocidos: B-008 impide afirmar operación HTTP→SQL→outbox→Neo; handlers probados con eventos controlados. No se marcaron REL-06 ni GRA-02 VERIFIED/MERGED. Pendiente revisión de I-1/I-2, validación de idempotencia HTTP y suites completas; Mongo secundario caído no debe impedir operación SQL.

### TC-SESSION-20261126-I3-009
- Fecha: 2026-11-26. Responsable: I-3; rama `docs/pr11-merge-checkpoint`, basada en `origin/develop` (`11ca103`).
- Verificación: `git fetch origin`, `git branch -r --contains 87982fe` y GitHub API confirman PR #11 fusionado en `develop` por `11ca103`; `verify` de ese commit constaba `in_progress` en la consulta. CI final: NOT_RUN/resultado aún no observado en esta sesión. Pruebas de código locales nuevas: NOT_RUN (solo inspección Git/GitHub).
- Alcance: actualizar evidencia de integración parcial en filas REL-06/GRA-02 y sección I-3; no modificar código ni dar por completadas las tareas. B-006 (build Next.js) y B-008 (operación SQL/API incompleta) siguen pendientes; próxima acción: comprobar resultado final de CI y coordinar con I-1 la escritura SQL y el flujo HTTP→Outbox→Neo antes de verificar GRA-02.

### TC-SESSION-20261126-I3-010
- Fecha: 2026-11-26, I-3, rama `feature/graph-traversals` desde `origin/develop` `11ca103`, incluye checkpoint propio `307405a` y código/evidencia `d427ba5`. Objetivo: RN-69..77/102/120/121/122, RF-24..27/33, PG-01..04/08..11/13; backend únicamente.
- Inspección: PR #11 fusionado, check `verify` de `11ca103` terminó `failure` en paso Build (anotación línea 50 de `.github/workflows/ci.yml`); falta directorio Next `app/`/`pages/`, sin alterar frontend. Los tres motores de prueba seguían healthy. `operations.mts` no inserta filas operativas completas y `AppModule` solo registra worker, por lo que B-008 sigue abierto.
- Implementado: handler Neo proyecta también distribución y sus tres relaciones oficiales de forma idempotente, con extremo obligatorio y transacción por evento; `backend/src/database/neo4j/traversal.mts` implementa BFS adelante/atrás por Lote→Proceso→Lote, mínimos niveles, frontera adicional, comunes, genealogía, proveedores, procesos, destinos y caminos acotados. No son todavía controladores ni `TraceResult`/`ImpactResult` completos. No se agregaron etiquetas, relaciones, tablas o dependencias.
- Evidencia observada mediante `node --experimental-strip-types --test tests/integration/canonical-graph.integration.mts` en Neo4j real 5.26 aislado: 1/1 OK; topología **de proyección controlada, no seed canónico multimodelo** produjo 31 nodos por etiqueta (Proveedor 3, Producto 7, Ubicacion 4, Lote 9, Proceso 5, Distribucion 3) y 35 relaciones oficiales por tipo (SUMINISTRA 4, CORRESPONDE_A 9, UTILIZADO_EN 8, GENERA 5, INCLUIDO_EN 3, SALE_DE 3, ENTREGADO_A 3). MP-001 → LP-001/002 nivel 1 y LP-003/004 nivel 2; LP-005 excluido; comunes LP-003/004 = MP-001/002; destinos Centro/Norte, no Sur; camino a LP-003 profundidad 2, a LP-005 ninguno; maxDepth=1 PARCIAL. JSON/CSV reales en `docs/pruebas/`. En prueba adicional de convergencia `graph-projection.integration.mts`: 2 rutas de nivel 2, un único lote en alcance y `maxPaths=1` PARCIAL/PATH_LIMIT.
- Verificaciones adicionales reales: `npm run test:integration` exit 0 (smoke 3/3, SQL 2/2, Neo/Mongo 2/2, runtime worker 1/1, Jest 3/3, build backend OK); las dos pruebas grafo nuevas ejecutadas juntas 2/2 OK; `npm run typecheck`, `npm run lint` y lint explícito `.mts` modificados exit 0 en Docker Node 22.22.0/npm 10.9.4. Build global: NOT_RUN en esta sesión; CI remoto del merge PR #11 FALLÓ (sin atribuir a Neo). DEMO-150, QE-01..05, inspecciones/stock/incidencia del escenario canónico y API impacto: NOT_RUN.
- Incremento posterior de la misma rama: `verification.mts` usa Outbox SQL real con lectura de secuencia y estado antes/después del recorrido: positivo `YES` aun con cola pendiente, `UNKNOWN` si cambia la secuencia o no se puede excluir descendencia, `NO` solo con lectura completa y cola Neo estable/sin pendientes. `node --experimental-strip-types --test tests/integration/graph-verification.integration.mts` con PostgreSQL 16 y Neo4j 5.26 aislados → 1/1 OK (repetido tras añadir comprobación de secuencia); `npm run typecheck --workspace backend` y ESLint explícito de los dos `.mts` → exit 0; lote independiente de mismo proveedor/producto no se propaga. Carrera de inserción Outbox durante lectura: NOT_RUN como caso de inyección determinista. No transforma esta verificación en endpoint integrado ni bloquea automáticamente; I-2 debe consumir el puerto revisado.
- Prueba complementaria PG-21: ejecución real adicional de `tests/integration/canonical-graph.integration.mts` en Neo4j aislado 1/1 OK; cap de 5 lotes (raíz + cuatro descendientes) `COMPLETO`, cap de 4 `PARCIAL/RESULT_LIMIT`. Valores observados añadidos al JSON y al borrador de póster; no cubre aún límite de 10000 ni API.
- Siguiente: I-1 resuelve B-008 y REL-09; I-2 integra calidad/expediente; I-3 completa contrato `TraceResult` y pruebas de límites/subgrafos, verifica caso canónico por servicios reales y luego DEMO-150/QE con equipo. `RESULTADOS_POSTER.md` es borrador provisional, no informe de fase concluida. UI continúa pospuesta.

### TC-SESSION-20261126-I3-011
- Fecha: 2026-11-26 (hora local 23:02–23:04), I-3, rama `feature/graph-traversals`, código/evidencia en commit `294a18f`. Tarea parcial GRA-03/GRA-05/QG-12, RF-24..28, RN-69..77/121/122; backend sin UI y sin cambios a contratos.
- Implementación: subgrafo productivo Neo4j con nodos de lotes ordenados por profundidad, procesos y pares de relaciones `UTILIZADO_EN`/`GENERA` reales; límites 500 nodos/1500 aristas, raíces prioritarias, sin aristas a extremos ausentes; `visualizationTruncated` independiente del resultado analítico. Solo cubre segmento productivo, no equivale aún a `TraceResult` completo ni a un grafo visual integrado con API.
- Pruebas (Docker Node 22.22.0 + Neo4j 5.26 aislado): primer `node --experimental-strip-types --test tests/integration/canonical-graph.integration.mts` FALLÓ con `Neo.ClientError.Statement.ArgumentError` porque LIMIT recibió `1501.0`; se corrigió usando `neo4j.int`. Repetición 1/1 OK: subgrafo MP-001 9 nodos/8 aristas, tope de 8 nodos truncado sin aristas huérfanas. Suite conjunta con `graph-projection` y `graph-verification` → 3/3 OK sobre PostgreSQL/Neo4j reales. `npm run typecheck`, `npm run lint` y ESLint explícito para los dos `.mts` nuevos/modificados → exit 0. `npm run build` global, DEMO-150, QE-01..05 y API multimodelo: NOT_RUN por B-006/B-008 y dependencias I-1/I-2.
- Evidencia en `docs/pruebas/graph-projection-actual.json`/CSV y `RESULTADOS_POSTER.md`; borrador documental requiere revisión I-2. Siguiente I-3: completar respuesta `TraceResult`, controles de tiempo/sync y pruebas de límites; I-1 operaciones SQL/API y REL-09, I-2 calidad/incidencias reales. No dar por completas tareas GRA-03/05 ni RF-28.

### TC-SESSION-20261126-I3-012
- Fecha: 2026-11-26 (hora local 23:11–23:25), I-3, rama `feature/pg-operational-integration` desde `c7cfe49`; Issue no asignada, autorización de I-1/I-2 comunicada por usuario, revisión humana todavía pendiente. RF-01/02/07/11/14/16/17/20/33/34; RN-25/28/40/48/101/110..120, RNF-04/05/08..12. Estado: incremento IMPLEMENTED y TESTING en rama, no VERIFIED/MERGED; B-008 resuelto para el flujo **reducido de prueba**, no para aceptación completa ni fixture canónico.
- Código: migración nueva `008_operation_codes.sql` (sin editar 001..007); escritor SQL de lotes, consumos, resultados, distribuciones y códigos; corrección de orden de parámetros UPDATE de inventario, saldo inicial y bloqueos/fechas; rutas NestJS con login/roles, recepción, producción, distribución, inspección e incidencia; expediente por handler Mongo existente y Outbox. Se añadió `@nestjs/platform-express` 11.0.10 con lockfile; `main.ts` configura CORS explícito y JSON de 1 MiB. No frontend, tablas/colecciones/relaciones adicionales ni cambio de API_CONTRACT. `RESULTADOS_POSTER.md` distingue esta prueba de 31/35 Neo aislado, canónico, DEMO-150 y benchmark.
- Pruebas reales: Docker Node 22.22.0 con PostgreSQL 16, MongoDB 8, Neo4j 5.26 aislados. Primera integración SQL FALLÓ con `INSUFFICIENT_STOCK` por UPDATE de existencia con lote/ubicación intercambiados; corregido. Primer test HTTP FALLÓ al arrancar NestJS sin adaptador HTTP; dependencia oficial instalada. Repetición HTTP de controles de login FALLÓ por contar 4 intentos inválidos además de 2 logins válidos dentro del límite de 5; se ajustó la prueba a 3 intentos y el sexto devolvió 429 + Retry-After. Un typecheck intermedio FALLÓ por tipo de encadenado de `header`, corregido. Ejecución final: `node --experimental-strip-types --test tests/unit/operations.spec.mts tests/unit/transactional-repositories.spec.mts` → 16/16 OK; `node --experimental-strip-types --test tests/unit/incident-auth.spec.mts` → 10/10 OK; `node --experimental-strip-types --test tests/integration/operations-sql.integration.mts` → 1/1 OK, 2 lotes, 5 movimientos, 3 eventos y 3 idempotencias; `node --test tests/integration/operations-http.integration.mjs` tras build backend → 1/1 OK, 8 eventos Neo/8 relaciones, 1 inspección/1 incidencia/1 expediente sincronizado, conflicto de idempotencia 409, parámetros dinámicos 422 y rate limit 429. `npm run typecheck --workspace backend`, `npm run build --workspace backend`, `npm run lint --workspace backend` y ESLint explícito de `.mts/.mjs` modificados → exit 0 al terminar. Los conteos son de dos conjuntos **distintos**, no sumables.
- Límites: las pruebas temporales no son seed funcional de DATA_MODEL §5, ni DEMO-150, ni impacto completo ni QE; fallos/races adicionales y aceptación RF P0/P1 NOT_RUN. Build global frontend sigue FALLANDO en CI previa por B-006 y no se ha repetido sobre esta rama (frontend pospuesto). `npm audit` al instalar adaptador informó 11 vulnerabilidades (3 moderate, 8 high); no se aplicó `audit fix --force`. Archivos de I-1/I-2, lockfile y `RESULTADOS_POSTER.md` requieren revisión por dueños; no marcar porcentajes, no afirmar CI verde.
- Próxima acción: completar seed canónico por servicios/outbox y `TraceResult`/impact API con coordinación I-1/I-2, después DEMO-150 y benchmark si hay tiempo y entorno. Solicitar revisión humana antes de PR/merge.

### TC-SESSION-20261126-I3-013
- Fecha: 2026-11-26 (hora local 23:31–23:37), I-3, rama `feature/pg-operational-integration`, sin commit/PR. Tarea de evidencia canónica BASE-06/REL-07..09/DOC-03/06/GRA-02..05 parcial, RF-07/11/12/14/16/17/20/24..27/33/34; RN-25/28/40/48/51..63/69..76/97..108. Autorización de I-1/I-2 comunicada para integración; revisión humana de sus módulos y de documentación aún pendiente. Frontend no iniciado.
- Se añadió `tests/integration/canonical-operations.integration.mjs`: catálogos iniciales insertados en SQL y proyectados por Outbox; cuatro recepciones, cinco producciones, tres distribuciones por servicios reales; consulta de los 12 saldos SQL, proyección real Neo4j y recorridos; seis plantillas oficiales en Mongo temporal, cuatro inspecciones por servicio, incidencia SQL y expediente Mongo por Outbox. UUID nuevos, esquema SQL temporal y base Mongo temporal; limpiar únicamente los datos creados por esta prueba. `docs/pruebas/canonical-multimodel-actual.json` y `RESULTADOS_POSTER.md` separan la evidencia canónica de la HTTP reducida y de la antigua proyección aislada.
- Primera ejecución `node --test tests/integration/canonical-operations.integration.mjs` con Docker Node 22.22.0, PostgreSQL 16, MongoDB 8 y Neo4j 5.26 FALLÓ `INVALID_TEMPLATE`: el harness enlazó erróneamente plantilla/producto. Se corrigió con mapeo explícito de los códigos oficiales sin cambiar validación del servicio. Repetición con los cuatro motores reales: **1/1 OK** (duración TAP ~5.2 s): 9 lotes, 5 órdenes, 3 distribuciones, 23 movimientos, 31 nodos y 35 relaciones, cuatro descendientes MP-001 con niveles exactos, comunes MP-001/MP-002 para LP-003/004, destinos SUC-01/02 sin SUC-03, cuatro inspecciones (tres NO_CONFORME), incidencia ABIERTA y expediente SINCRONIZADO. `npx eslint tests/integration/canonical-operations.integration.mjs` → exit 0. No se midió latencia; duración TAP no es benchmark.
- Alcance pendiente: no hay semilla final repetible de DATA_MODEL §5 con UUID fijos; el escenario se ejerce por servicios, no por todos los endpoints HTTP. La transición EN_ANALISIS se probó posteriormente (sesión 014). `TraceResult`/`ImpactResult` API, bloqueos, DEMO-150, DA-01..08, QE-01..05, E2E y CI de esta rama: NOT_RUN. No marcar GRA-03/05, DOC-03/06 ni REL-07..09 VERIFIED/MERGED; las verificaciones son parciales. PR necesita revisión humana I-1/I-2 y posterior integración.
- Siguiente acción: completar estado/análisis e impacto de contrato en API sin suponer que los resultados actuales prueban DA/QE; ejecutar suite y documentar las brechas restantes.

### TC-SESSION-20261126-I3-014
- Fecha: 2026-11-26 (hora local 23:37–23:39), I-3 en `feature/pg-operational-integration`, sin commit/PR. Continuación DOC-06/RF-23/RN-64/65/117/119, PM-19/22: rutas oficiales `POST /incidents/:id/start-analysis` y `/close`, orquestación I-2 con idempotencia SQL, lock de incidencia, resolución obligatoria, expediente SINCRONIZADO y versión confirmada desde Outbox. Se corrigió lector de payload JSONB del repositorio I-1 para aceptar objeto del driver real; códigos oficiales 409. Ningún evento Mongo de cierre ni desbloqueo automático.
- Pruebas reales: `npm run typecheck --workspace backend` y `npm run build --workspace backend` exit 0. `node --test tests/integration/canonical-operations.integration.mjs tests/integration/operations-http.integration.mjs` en Docker Node 22.22.0 y PostgreSQL 16/MongoDB 8/Neo4j 5.26 → 2/2 OK: canónico culmina EN_ANALISIS con expediente SINCRONIZADO; HTTP reducido comprueba replay de inicio/cierre, cierre pendiente rechazado 409, cierre confirmado 200 y nuevo intento rechazado 409. `npm run lint --workspace backend` y ESLint explícito de repositorio `.mts` y pruebas `.mjs` modificadas → exit 0. CI, impacto API, bloqueos, DEMO-150 y QE: NOT_RUN; no declarar aceptación completa.
- Próxima acción: lint y regresión; implementación/validación de impacto API, bloqueos y casos de fallo con revisión humana I-1/I-2. Frontend continúa expresamente pospuesto.

### TC-SESSION-20261126-I3-015
- Fecha: 2026-11-26 23:40–23:54 local, I-3, rama `feature/pg-operational-integration`, sin commit/PR ni Issue vinculada. Incremento DOC-07/GRA-06, RF-29..32/35, RN-78..96/118/121/124, PI-07/08/10 parciales. Autorización I-1/I-2 comunicada por usuario; revisión humana de módulos ajenos, contratos y docs pendiente. No frontend.
- Se agregaron `backend/src/modules/lot-blocks/{block-write.service,blocks.controller}.ts` con bloqueo manual de raíz/descendientes, validación Neo conservadora, locks SQL, idempotencia y retiro individual; registro en `app.module.ts`. Se creó `backend/src/modules/impact/{impact.service,impact.controller}.ts` para la ruta oficial de impacto: recorrido Neo, cantidades/stock/bloqueos/destinos PG, calidad/expediente Mongo, advertencias y secciones PARCIAL/NO_DISPONIBLE. Totales de stock y destinos se consultan completos cuando se trunca detalle; calidad se agrupa por lote sin cargar todo el historial. Los códigos añadidos al filtro son oficiales. Pruebas ampliadas: HTTP reducido verifica auth, forma, expediente pendiente/sincronizado, bloqueo/replay/retiro y cierre sin liberar otro bloqueo; canónico verifica impacto 5 lotes/2 destinos, profundidad 1 PARCIAL, no propagar MP-004, bloqueo/rechazo de distribución y retiro.
- Verificaciones reales en Node 22.22.0, PostgreSQL 16, MongoDB 8 y Neo4j 5.26: `npm run typecheck --workspace backend`, `npm run build --workspace backend`, `npm run lint --workspace backend` y `npx eslint tests/integration/{canonical-operations,operations-http}.integration.mjs` → exit 0. Primera prueba canónica ampliada FALLÓ por timeout Neo4j y repetición independiente 1/1 OK; primera ejecución del impacto FALLÓ por orden de UUID en la expectativa y tras ordenar por nivel/código/UUID la compilación intermedia FALLÓ por inferencia TS; ambos corregidos y repetidos con 1/1 OK. Una ejecución de ambas suites en paralelo FALLÓ `idle` vs `applied` por consumidor Outbox compartido; ejecución individual HTTP 1/1 OK y comando `node --test --test-concurrency=1 tests/integration/canonical-operations.integration.mjs tests/integration/operations-http.integration.mjs` → **2/2 OK**. No usar duración TAP como benchmark.
- Pendientes: `TraceResult` por API y cobertura de sus cinco modalidades; dos incidencias bloqueando un lote, carreras de lock, fallos de fuentes, dossier patch, DEMO-150/DA-01..08, QE-01..05, E2E y CI de rama NOT_RUN. Las suites contra Outbox de la misma instancia deben serializarse. No marcar GRA-06/DOC-07 VERIFIED/MERGED ni declarar DoD: faltan casos críticos y revisiones I-1/I-2. Próxima acción: completar trazabilidad HTTP y casos adversos; después seed demo/benchmark independientes con equipo.

### TC-SESSION-20261127-I3-016
- Fecha: 2026-11-27 00:02–00:12 local, I-3 en `feature/pg-operational-integration`, sin commit/PR. Tarea parcial GRA-03/GRA-05, RF-24..29, RN-69..77/121/122/124; módulo propio de I-3. Sin frontend. Autorización de I-1/I-2 para integración comunicada; revisión humana pendiente.
- Se añadieron `backend/src/modules/traceability/{traceability.service,traceability.controller}.ts` y se registraron en `app.module.ts`. Cinco modalidades oficiales con enriquecimiento SQL (nombres/productos/fechas/destinos) y IDs visuales estables; grafo construido solo con tramos productivos reales. Verificación conservadora de Outbox antes/después, advertencias `DEPTH_LIMIT`/`GRAPH_PENDING`/`CONCURRENT_CHANGES`/`DETAIL_LIMIT` y `depthByRoot` en comunes. `common-origins` exige analista; POST devuelven 200 según contrato. Sin nuevos contratos, colecciones ni tablas.
- Pruebas reales con PostgreSQL 16, MongoDB 8, Neo4j 5.26 y Node 22.22.0: `npm run typecheck --workspace backend`, `npm run build --workspace backend`, `npm run lint --workspace backend` y `npx eslint tests/integration/{canonical-operations,operations-http}.integration.mjs` → exit 0 tras corregir una intersección de tipos mal escrita y una conversión de tipos. Primera ejecución FALLÓ por nombre duplicado `forward` en el harness y porque los POST devolvían 201; corregidos y repetidos. `node --test --test-concurrency=1 tests/integration/canonical-operations.integration.mjs tests/integration/operations-http.integration.mjs` → **2/2 OK**: canónico con cinco modalidades y cero ruta MP-001→LP-005; HTTP con auth 401/403, entradas 400/404 y resultados reducidos. Duración TAP no es benchmark.
- Límites: no hay semilla final con UUID fijos ni trazabilidad canónica por HTTP; no se probaron límites de 10000 lotes, deadline, truncamiento visual ni fallos de Neo/PG; DEMO-150, QE-01..05, E2E y CI de esta rama NOT_RUN. No marcar GRA-03/05 como VERIFIED/MERGED. Siguiente: lint, cerrar `TraceResult` con pruebas de límites/fallo y continuar con seed DEMO-150 y benchmark en entornos separados.

### TC-SESSION-20261127-I3-017
- Fecha: 2026-11-27 00:10–00:35 local, I-3 en `feature/pg-operational-integration`, sin commit/PR. Tarea parcial REL-06/RNF-09/TP-15/TP-16/TP-23/CP-18/PI-10..12/PG-15/16/PM-13/14, RF-07/11/14/31/33/34/35. Archivos nuevos de prueba; sin cambios de contrato ni frontend. Revisión humana I-1/I-2 pendiente.
- Se añadieron `tests/integration/concurrency-sql.integration.mjs` y `tests/integration/outbox-recovery.integration.mjs`. El primero ejerce carreras reales: consumo 70/50 sobre 100, idempotencia con la misma clave y carrera bloqueo/distribución con lock de lote, más rechazo posterior `LOT_BLOCKED`. El segundo inyecta fallo en la aplicación del Outbox para Neo4j y MongoDB, recupera un evento `PROCESANDO`, comprueba replay sin duplicados y fallo permanente sin reintento. Evidencia en `docs/pruebas/concurrency-recovery-actual.json`.
- Se añadió después el caso RN-91/92/94: dos incidencias bloquean el mismo lote, retiro individual mantiene `bloqueado=true` y `cantidad_utilizable=0`, retiro final libera. Primera repetición FALLÓ porque `v_inventario` casta NUMERIC sin tres decimales; se comparó con Number.
- Pruebas reales con PostgreSQL 16, MongoDB 8, Neo4j 5.26 y Node 22.22.0. Primera ejecución de recuperación FALLÓ por `db is not defined` en el `finally` (dejó el contenedor colgado y se retiró); corregida. Segunda FALLÓ `applied` → `failed` porque el evento de recepción no tenía catálogos proyectados; se encolaron los tres eventos de catálogo y se drenaron en orden. Tercera pasó 1/1. Lint de los `.mjs` nuevos FALLÓ por `URL` no importado y `throw` en `finally`; corregido. Ejecución final: `npm run typecheck --workspace backend`, `npm run lint --workspace backend`, ESLint de las cuatro pruebas `.mjs` y `node --experimental-strip-types --test --test-concurrency=1` de las cinco pruebas de integración → **5/5 OK**. Duración TAP no es benchmark.
- Límites: el fallo se inyecta en la función de aplicación, no apagando motores ni reiniciando procesos; no se probó caída de red real ni recuperación de worker tras reinicio. Dos incidencias por lote ya se probaron; falta que el cierre de una incidencia conserve bloqueos activos de la otra. DEMO-150, DA-01..08, QE-01..05, E2E y CI de rama NOT_RUN. No marcar tareas como VERIFIED/MERGED. Siguiente: dos bloqueos activos por lote y liberación individual, después DEMO-150 y benchmark en entornos separados.

### TC-SESSION-20261127-I3-018
- Fecha: 2026-11-27 00:35–01:10 local, I-3 en `feature/pg-operational-integration`, sin commit/PR. Tarea DEMO-01/DEMO-02 parcial, DA-01..07, RF-07/11/12/14/16..35, RN-69..96/110..124. UUID deterministas de harness, no los rangos oficiales de DATA_MODEL §5.1; sin frontend, sin benchmark y sin HTTP para toda la semilla.
- Se añadió `tests/integration/demo150-seed.integration.mjs`: 10 grupos con tres recepciones y seis órdenes por grupo, 40 transferencias rotativas, seis plantillas, ocho inspecciones y una incidencia por grupo; servicios SQL/Mongo reales, catálogos y operaciones drenados por Outbox, transición EN_ANALISIS, validadores y proyección completos. Evidencia en `docs/pruebas/demo150-actual.json`.
- Resultados observados 1/1 OK: 150 lotes, 60 órdenes, 40 distribuciones, 350 movimientos, 159 eventos Neo, 279 nodos y 540 relaciones por tipo; 80 inspecciones (40 no conformes), 10 incidencias/expedientes; dashboard 150/60/10/0; sin eventos pendientes. D01-r1: 12 descendientes en niveles 2/4/4/2, comunes de b2/c2 = r1/r2/r3, dos rutas a d1, camino mínimo 4 a f1 y ninguna ruta a D02-f1. Impacto D01: 13 lotes, cuatro destinos, stock f1 28/8/4 sin doble conteo. Profundidad 1 PARCIAL; bloqueo manual verificado rechazó una distribución; el cierre conservó el bloqueo y el retiro individual lo liberó. Duración TAP ~20–24 s, no es benchmark.
- Correcciones durante la sesión: dos aserciones iniciales estaban mal derivadas del plan (movimientos 290 en vez de 350 y stock f1 12 en vez de 8); se corrigieron antes de la ejecución exitosa. Alias SQL `neoEvents` sin comillas se normalizó a minúsculas y se entrecomilló. No se inventaron conteos. `npx eslint tests/integration/*.mjs` falló por nueve errores `no-undef` en `engines-smoke.mjs`, archivo preexistente no modificado en esta rama; el lint explícito de las cinco pruebas `.mjs` de esta rama pasó. Ejecución conjunta final de las seis pruebas de integración en serie → **6/6 OK**.
- Límites: no hay `manifest.json`/`expected-results.json` independientes ni UUID oficiales de fixture; la semilla no se ejecutó por HTTP completo ni se repitió en entorno usado; DA-08/QE-01..05, E2E/UI y CI de rama NOT_RUN. No marcar DEMO-01/02 ni DA-01..07 como VERIFIED/MERGED. Siguiente: generador SQL/Cypher equivalente y benchmark QE-01..05 en entorno separado, con revisión I-1/I-2 antes de PR.

### TC-SESSION-20261127-I3-019
- Fecha: 2026-11-27 00:30–00:40 local, I-3 en `feature/pg-operational-integration`. Revisión humana de I-1/I-2 comunicada como aprobada por el usuario; no se sustituye por revisión de IA. Commit `f967f85` (`feat(backend): integrate operational, quality and analytical APIs`), rama publicada en `origin/feature/pg-operational-integration`. Sin merge a `develop`.
- Verificaciones previas al commit: `npm run typecheck --workspace backend`, `npm run build --workspace backend`, `npm run lint --workspace backend`, `node --experimental-strip-types --test tests/unit/*.spec.mts` → **55/55 OK**; ESLint explícito de las cinco pruebas `.mjs` propias de la rama → exit 0; seis pruebas de integración en serie → **6/6 OK**. `git diff --check` solo mostró avisos LF→CRLF. `npx eslint tests/integration/*.mjs` sigue fallando por el archivo preexistente `engines-smoke.mjs`, no modificado aquí.
- PR: `gh` no está instalado en este entorno. La URL manual es `https://github.com/EdwarDa2/TraceChain/pull/new/feature/pg-operational-integration`. CI remoto del PR y build global: NOT_RUN; B-006 (Next.js sin `app/`/`pages/`) sigue abierto por la decisión de posponer frontend. No marcar tareas VERIFIED/MERGED hasta verificar CI e integración en `develop`.
- Siguiente: crear el PR manualmente o instalar `gh`, observar el CI y decidir B-006 con el equipo; después continuar con DA-08/QE-01..05 en entorno separado.

### TC-SESSION-20261127-I3-020
- Fecha: 2026-11-27 06:35–06:40Z, I-3 desde `develop` actualizado (`a3b3b51`). Registro de integración, no código funcional nuevo. Sin frontend.
- Verificación observada: GitHub API confirma PR #12 `state=closed`, `merged_at=2026-11-27T06:34:16Z`, `merge_commit_sha=a3b3b519cfc23eeb7de5bd7f0ff2962ab539ee33`, base `develop`. Git local confirma `origin/develop` en `a3b3b51` con los dos commits de la rama (`f967f85`, `a701ee1`). B-008 queda resuelto; B-006 sigue abierto.
- CI: el check `verify` del head `a701ee1` (run 45952689953) fue consultado dos veces y siguió `status=in_progress`, `conclusion=null`. No se afirma CI verde ni fallido; pendiente de conclusión real. No marcar tareas como VERIFIED por este registro.
- Siguiente: consultar el resultado final de `verify`; si falla solo por B-006, documentar la decisión del equipo. Después continuar con DA-08/QE-01..05 en entorno separado y, si aplica, release `develop→main`.

### TC-SESSION-20261127-I3-021
- Fecha: 2026-11-27 06:45Z, I-3 en `fix/ci-contracts-build-order` desde `develop` (`a3b3b51`). Corrección de infraestructura compartida (scripts raíz) con autorización de revisión comunicada; B-006 sigue requiriendo decisión del equipo.
- CI real: check `verify` del PR #12 (run 45952689953, head `a701ee1`) terminó `status=completed`, `conclusion=failure`, `completed_at=2026-11-27T06:35:00Z`, 11 anotaciones. Causa observada: `Cannot find module '@tracechain/contracts'` y parámetros `any` implícitos derivados de esa resolución; **no** fue B-006, porque el fallo ocurrió en `typecheck`, antes del build de Next.js.
- Fix: `package.json` raíz ejecuta `npm run build --workspace @tracechain/contracts` antes de `typecheck` y antes de `build`, para que los `.d.ts` del paquete compartido existan en un checkout limpio. Verificación local con `packages/contracts/dist` eliminado: `npm run lint`, `npm run typecheck`, `npm run build --workspace backend` y build de contratos → exit 0. No se desactivó ninguna verificación.
- Decisión autorizada por el usuario: esqueleto mínimo de Next.js. Se añadieron `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx` y `frontend/next-env.d.ts` generado por Next; no hay vistas, rutas funcionales, estilos ni lógica de frontend. B-006 queda resuelto para build.
- Verificación local completa desde checkout limpio de contratos: `npm run lint`, `npm run typecheck` y `npm run build` → exit 0 en Node 22.22.0; `next build` compiló y generó las tres páginas estáticas (`/`, `/_not-found`). No se desactivó ningún paso del CI.
- Pendiente: el `verify` del PR #12 ya es `failure`; este fix debe integrarse y ejecutarse un CI nuevo para comprobar green. No afirmar CI verde hasta ver el resultado real. DA-08/QE-01..05 NOT_RUN.

### TC-SESSION-20261127-I3-022
- Fecha: 2026-11-27 06:50Z, I-3 en `fix/ci-contracts-build-order`. Continuación de I3-021 con autorización expresa del usuario para esqueleto mínimo de Next.js. Sin desarrollo de frontend funcional.
- Archivos nuevos: `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`, `frontend/next-env.d.ts`. El texto de la página indica explícitamente que la interfaz está pendiente; no se crearon componentes, estilos, rutas de negocio ni llamadas API.
- `npm run lint`, `npm run typecheck` y `npm run build` pasaron en contenedor Docker Node 22.22.0. Build de Next.js 16 con Turbopack: compilación correcta y tres páginas estáticas generadas. B-006 pasa a resuelto localmente; CI remoto del fix: NOT_RUN.
- La rama `docs/record-pr12-merge` (PR #13) se actualizó con estos commits para que un solo PR contenga registro y corrección; el PR de `fix/ci-contracts-build-order` queda como alternativa y puede cerrarse si #13 se fusiona.
- Siguiente: esperar el `verify` del PR #13 y verificar la conclusión real antes de marcar verde. Después, benchmark DA-08/QE-01..05.

### TC-SESSION-20261127-I3-023
- Fecha: 2026-11-27 06:50Z, I-3 desde `develop` (`f9c1030`). Registro final de CI e integración, sin código nuevo.
- GitHub API confirma PR #13 `state=closed`, `merged=true`, `merged_at=2026-11-27T06:49:09Z`, `merge_commit_sha=f9c1030406abfa37c24cd26b0849d2ddd5b20a81`, base `develop`. El check `verify` del head `2d07f5f` terminó `conclusion=success` a las 06:47:24Z (run 45953924797). B-006 pasa a resuelto; B-008 ya estaba resuelto en I3-020.
- Estado observable: `develop` contiene PR #12 y #13, lint/typecheck/build globales verdes en CI. No se afirma que todas las tareas estén VERIFIED: faltan DA-08/QE-01..05, UI funcional y E2E. No se hizo release `develop→main` ni tag.
- Siguiente: benchmark SQL/Cypher equivalente QE-01..05 y DA-08 en entorno separado; después, si el equipo autoriza F4, implementar las 14 vistas.

### TC-SESSION-20261127-I3-024
- Fecha: 2026-11-27 07:10Z, I-3 en `bench/qe-benchmark` desde `develop` (`f9c1030`). Tarea BENCH-01 parcial y DA-08 base; sin frontend. Sin nuevos tipos de nodo, tablas ni colecciones.
- Se añadieron `tests/benchmark/{run.mjs,summarize.mjs,lib/generator.mjs,lib/queries.mjs}`, consultas de referencia en `database/{relational,graph}/queries/qe-benchmark.*` y evidencia `tests/benchmark/results/` y `docs/pruebas/benchmark-actual.{json,csv}`. Generador con UUID v4 deterministas por caso, semilla 42, diez componentes, capas dirigidas y reutilización controlada de insumos; SQL y Neo cargados con los mismos UUID y proyección por tipo.
- Verificación real en PostgreSQL 16.16, Neo4j 5.26.34, Node 22.22.0, Linux x64, 12 CPU, 3.69 GB: los tres casos base 100/1000/10000 lotes con profundidades 3/8/15 y 70/880/9370 procesos pasaron la comparación de hash de UUID/niveles/destinos en QE-01..05 antes de medir. 5 calentamientos y 30 repeticiones por motor/consulta/caso, orden alternado: **900 mediciones, 150 calentamientos, 0 errores**. Mediana/p95 SQL vs Cypher (ms): QE-01 3.096/4.841 vs 7.871/11.240 (100) y 172.699/525.581 vs 147.235/258.307 (10000); QE-04 150.127/581.719 vs 42.219/69.766 (10000). No se descartaron repeticiones; la desviación alta se conserva en los datos crudos.
- Correcciones: rutas relativas de esquemas, Cypher `MERGE` sin `WITH`, placeholders `$1` duplicados en QE-03, duplicados por múltiples caminos en QE-03/QE-05 y UUID compartidos entre casos; todo corregido y repetido antes de registrar resultados. No se inventaron tiempos.
- Límites: no se ejecutaron casos adicionales a volumen fijo 1000 variando profundidad 3/8/15 ni las topologías lineal/ramificada/convergente/independiente; tampoco EXPLAIN/PROFILE ni medición API extremo a extremo. No afirmar superioridad general: la comparación vale solo para esta topología y entorno. BENCH-01 queda TESTING, no VERIFIED. Siguiente: casos adicionales de DA-08 y, si el equipo autoriza F4, UI funcional y E2E.

### TC-SESSION-20261127-I3-025
- Fecha: 2026-11-27 07:15Z, I-3 desde `develop` (`4443424`). Registro de integración del benchmark, sin código nuevo.
- GitHub API confirma PR #15 `state=closed`, `merged=true`, `merged_at=2026-11-27T07:13:06Z`, `merge_commit_sha=444342405a9597c6a939fd67a779e5c50ddff9bb`, base `develop`. El check `verify` del head `20938df` terminó `conclusion=success` (run 45956645291, 07:12:32Z). El conflicto de `PROGRESS.md` con PR #14 se resolvió conservando I3-023 e I3-024 en orden cronológico.
- Estado observable: `develop` contiene PR #12, #13, #14 y #15 con CI verde en los PR #13 y #15. BENCH-01 continúa TESTING: no se ejecutaron los casos adicionales a volumen fijo 1000 con profundidades/topologías, ni EXPLAIN/PROFILE ni E2E. No se hizo release `develop→main` ni tag.
- Siguiente: completar los casos adicionales de DA-08 si el equipo los requiere; después, con autorización para F4, implementar UI funcional y E2E, y finalmente release.

### TC-SESSION-20261127-I3-026
- Fecha: 2026-11-27 07:20Z, I-3 desde `develop` (`cc2114b`). Continuación de BENCH-01/DA-08 sin frontend y sin contratos nuevos.
- Se extendió `tests/benchmark/lib/generator.mjs` con perfiles `depth` y `topology` (lineal, ramificada, convergente, independiente), ponderación de capas y conteo de insumos por perfil; `run.mjs` acepta `BENCH_PROFILE`, `BENCH_TOPOLOGY` y `BENCH_DEPTH`, y escribe resultados con sufijo de perfil. `summarize.mjs` consolidó los nueve perfiles.
- Resultados observados: 2 700 mediciones, 450 calentamientos, **45/45 comparaciones de equivalencia correctas** y **60 errores**, todos en QE-03 SQL de los dos perfiles con profundidad 15: las 30 repeticiones de cada uno excedieron `statement_timeout=10000` (media ~10.8 s); se conservaron en CSV/JSON, no se descartaron. Cypher completó QE-03 en esos perfiles (mediana 1 925.838 ms a 1 000 lotes y 11 589.749 ms a 10 000). A 1 000 lotes, QE-01 SQL: mediana 3.589/5.971/169.958 ms para profundidad 3/8/15; Cypher: 8.091/11.058/139.332 ms. Topologías a profundidad 8: independiente la más rápida, ramificada con 99 descendientes en QE-01.
- Correcciones: identificador SQL con guiones (normalizado), `pairIds` entre capas consecutivas y consulta QE-03 Cypher con subconsulta `EXISTS` para intersección equivalente. Se repitieron todos los perfiles tras el cambio de consulta. Lint de los cuatro archivos del benchmark → exit 0.
- Límites: aún no se ejecutaron EXPLAIN ANALYZE/PROFILE ni medición API extremo a extremo; el timeout de QE-03 SQL queda como fallo abierto y no se afirma superioridad general. BENCH-01 sigue TESTING; falta UI/E2E y release. Siguiente: decidir si se optimiza QE-03 SQL o se documenta como límite, y completar F4 si el equipo autoriza vistas.

### TC-SESSION-20261127-I3-027
- Fecha: 2026-11-27 14:10Z, I-3 desde `develop` (`2aa4b50`). PR #17 verificado como fusionado; sin código de aplicación nuevo. Continuación de BENCH-01/DA-08.
- Se añadió `tests/benchmark/explain.mjs`, que carga un caso real de 1 000 lotes/profundidad 8 con el generador compartido y ejecuta `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` para QE-01..05 y `PROFILE` Cypher para las mismas consultas, guardando planes y tiempos de ejecución del plan en `docs/pruebas/benchmark-plans.json`. Estos diagnósticos no se incluyen en las 2 700 mediciones de latencia.
- Verificación real: `node --test tests/benchmark/explain.mjs` → 1/1 OK; ESLint del script → exit 0. Tiempos de ejecución del plan SQL observados: 2.724, 1.854, 5.012, 2.168 y 2.112 ms para QE-01..05; planes Cypher con operadores reales (`VarLengthExpand`, `EagerAggregation`, `NodeUniqueIndexSeek`, etc.) y 36/44/35/1/1 filas. Dos correcciones previas: ruta de salida mal resuelta y extracción del JSON de EXPLAIN; ambas repetidas con éxito.
- Límites: no se midió latencia API extremo a extremo, no se resolvió el timeout de QE-03 SQL a profundidad 15 y no hay UI/E2E. BENCH-01 sigue TESTING. Siguiente: decidir si optimizar QE-03 SQL o documentarlo como límite, y completar F4 solo con autorización para vistas funcionales.

### TC-SESSION-20261127-I3-028
- Fecha: 2026-11-27 14:20Z, I-3 desde `develop` (`1c5cdf8`). PR #18 verificado como fusionado; sin cambios de contrato ni vistas funcionales.
- Se añadió `tests/benchmark/api-latency.integration.mjs`: levanta NestJS con esquema SQL, base Mongo y UUID de Neo temporales, siembra una topología pequeña por servicios, drena Outbox de ambos destinos y mide seis endpoints autenticados (trazabilidad adelante/atrás/genealogía/comunes/caminos e impacto) con 5 calentamientos y 30 repeticiones. Evidencia en `docs/pruebas/api-latency-actual.{json,csv}`.
- Resultado real: **1/1 OK, 180 peticiones, 0 errores**. Medianas (ms): forward 58.927, backward 62.912, genealogía 45.776, comunes 40.058, caminos 38.571, impacto 50.707; p95 máximo 140.022 en backward. `npm run build --workspace backend` y ESLint del script → exit 0. Estos tiempos son HTTP extremo a extremo y no se comparan con los 2 700 registros driver→motor.
- Límites: no se resolvió el timeout de QE-03 SQL a profundidad 15; UI/E2E y release siguen pendientes. No afirmar objetivos RNF-01/02 cumplidos: solo se observó un escenario pequeño. Siguiente: decidir optimización de QE-03 o documentar límite; si el equipo autoriza F4, implementar las vistas funcionales.

### TC-SESSION-20261127-I3-029
- Fecha: 2026-11-27 14:30Z, I-3 desde `develop` (`b4fc282`). PR #19 verificado como fusionado; corrección de consulta SQL, sin cambios de esquema ni contrato.
- Causa del timeout observado en I3-026: la CTE recursiva original arrastraba `ARRAY[...]` de nodos vistos y usaba `NOT id = ANY(seen)`, lo que enumeraba caminos y crecía con la convergencia. Se sustituyó por BFS por niveles con `UNION` (deduplicación por lote/nivel) en `tests/benchmark/lib/queries.mjs`; el grafo es acíclico por construcción, por lo que el arreglo no era necesario.
- Verificación real: tras un humo 1/1 en profundidad 15, se repitieron los **nueve perfiles completos** con 30 repeticiones y 5 calentamientos → **2 700 mediciones, 45/45 equivalencias, 0 errores**. QE-03 SQL pasó de timeout a mediana 4.633 ms (1 000 lotes/profundidad 15) y 4.149 ms (10 000 lotes/profundidad 15). `node tests/benchmark/summarize.mjs` → `totalErrors=0`; `node --test tests/benchmark/explain.mjs` → 1/1 OK con planes actualizados; ESLint de `queries.mjs` → exit 0. No se descartaron ejecuciones previas: el registro histórico quedó en versiones anteriores de la evidencia.
- Límites: no se comparó esta CTE optimizada contra una implementación alternativa de aplicación; la ventaja observada es solo para estas consultas y datos. Quedan UI/E2E y release. BENCH-01 sigue TESTING hasta aceptación.

### TC-SESSION-20261127-I3-030
- Fecha: 2026-11-27 14:40Z, I-3 en `feat/frontend-palette` desde `develop` (`e027876`). Usuario autorizó F4 y delegó la paleta; se cargaron `emil-design-eng`, `impeccable` y `design-taste-frontend`. Queda abierta la decisión de prioridad de flujo (analítico/operaciones), registrada como pendiente, sin inventarla.
- Implementación: `frontend/src/app/globals.css` con tokens de paleta moderna Restrained para Operate, superficies/tinta/bordes, estados semánticos, foco, selección, caret, scrollbar, numeración tabular, `:active` y `prefers-reduced-motion`; `layout.tsx` importa el CSS y `page.tsx` usa `data-surface`/`data-muted`. No se crearon vistas funcionales ni componentes de negocio. D-003 registra la contradicción violeta y su alcance solo semántico.
- Verificación real: `npm run lint --workspace frontend`, `npm run typecheck --workspace frontend` y `npm run build --workspace frontend` → exit 0; `next build` generó `/` y `/_not-found`. Detector mecánico de Impeccable (`detect --json --changed`) → `[]`, sin hallazgos. No se ejecutó still visual completo porque aún no hay superficies funcionales que revisar.
- Límites: F4 sigue pendiente; `PRODUCT.md`/`DESIGN.md` no se han escrito porque falta la respuesta de prioridad de flujo. Siguiente: confirmar flujo principal, completar init de producto, sistema de diseño y las 14 vistas sobre los endpoints verificados.

### TC-SESSION-20261127-I3-031
- Fecha: 2026-11-27 15:10Z, I-3 en `feat/read-api` desde `develop` (`d9c3c90`). Usuario autorizó F4 y las tres skills; se tomó el flujo analítico como prioritario por `PROJECT.md §1.1`, registrándolo en `frontend/PRODUCT.md`. Sin cambios de contrato ni esquema.
- Backend: se añadieron endpoints de lectura reales (`backend/src/modules/queries/`) para catálogos, lotes, inventario, movimientos, órdenes, distribuciones, inspecciones, plantillas, calidad, incidencias, expedientes, bloqueos, dashboard y sistema, más altas de catálogos y cambio de estado. `tests/integration/read-api.integration.mjs` → 1/1 OK con PostgreSQL, MongoDB y Neo4j reales, incluyendo auth 401, validación 400, duplicado 409 y escritura de catálogo.
- Frontend: `frontend/PRODUCT.md`, `DESIGN.md`, `globals.css`, providers de auth/Query, hook `use-api`, componentes comunes y 14 rutas operativas sobre endpoints verificados. Prioridad analítica: dashboard, inspecciones, incidencias, impacto y trazabilidad; operaciones y catálogos como soporte. No se conectó un GraphViewer visual: la trazabilidad ofrece alternativa textual.
- Verificación: `npm run typecheck`, `lint` y `build` de backend y frontend → exit 0; `next build` generó 14 rutas; detector de Impeccable → `[]`. No se ejecutó revisión visual completa en navegador ni auditoría WCAG manual; E2E sigue pendiente.
- Límites: BASE-04, REL-12, DOC-08/09 y GRA-07 quedan TESTING, no VERIFIED. Faltan GraphViewer visual, navegación E2E real, foco/contraste auditados y release. Siguiente: revisar en navegador, corregir hallazgos y completar TEST-04.

### TC-SESSION-20261127-I3-032
- Fecha: 2026-11-27 17:10Z, I-3 en rama de rediseño frontend (`redesign/frontend-platform`), worktree aislado. Usuario solicitó rediseño integral conservando backend, contratos, reglas, resultados y pruebas. Skills verificadas en disco: `design-taste-frontend/SKILL.md`, `impeccable/SKILL.md` y `emil-design-eng/SKILL.md`; se aplicaron para dirección, auditoría y microinteracciones. Auditoría previa documentada en `docs/pruebas/ui-audit-before.md`.
- Cambios: sistema de diseño Operate en `globals.css` (tokens monocromáticos, tipografía fija, paneles, tablas densas, filtros, badges, estados y grafo), `components/ui.tsx` reutilizable, sidebar agrupada con iconos Lucide y menú de usuario inferior, dashboard como centro de control, formularios laterales en inventario/producción/distribución/catálogos, espacios de trabajo de inspecciones e incidencias, y `GraphViewer` con Cytoscape + leyenda + zoom + panel lateral en trazabilidad e impacto. No se modificó backend ni contratos; el cambio de catálogo que había empezado quedó en stash fuera de esta rama.
- Verificación real: `npm run typecheck`, `lint` y `build` del workspace frontend → exit 0; `next build` generó 14 rutas; detector de Impeccable → `[]` tras eliminar el borde lateral del banner. Capturas reales del navegador confirmaron login, dashboard con datos reales (30 lotes/21 órdenes/1 incidencia) y navegación agrupada sin errores de consola. No se completó Lighthouse/E2E ni auditoría manual WCAG; la revisión de todas las vistas en navegador sigue en curso.
- Límites: F4 continúa TESTING, no VERIFIED. El grafo usa datos reales de la API; no se agregaron mocks. Siguiente: terminar revisión visual por breakpoint, ejecutar Lighthouse/E2E, corregir hallazgos y preparar PR de la rama de rediseño.

### TC-SESSION-20261127-I3-033
- Fecha: 2026-11-27 21:10Z, I-3 en `redesign/frontend-platform-wt` (worktree). Usuario aportó imagen de inspiración y pidió tarjetas modernas y limpias, minimalismo; se mantuvo la restricción de no inventar métricas ni tocar backend/contratos.
- Cambios: `globals.css` añade tarjetas de métrica con radio 12px, sombra sutil, icon-tile semántico y footer; `.panel` con radio 10px y sombra; topbar con buscador, campana con contador y avatar; `.mini-bars` para distribución real de actividad; media queries ajustadas (4 columnas >1100px, 2 columnas 900–1100px, 1 columna <900px). `layout.tsx` conecta búsqueda con `/inventory?search=` y muestra avatar/contador de incidencias. `dashboard/page.tsx` reescrito con KPIs enlazados, gráfica de barras derivada de `recent-activity` (6 producción / 3 distribución / 2 recepción / 1 incidencia), tabla densa, accesos rápidos y estado del sistema. `lib/types.ts` añade `entityId` a `Activity` para enlazar el impacto sin inventar rutas.
- Verificación real: `npm run typecheck`, `lint` y `build` del frontend → exit 0; `next build` generó 14 rutas; detector de Impeccable → `[]`. Capturas reales en navegador confirmaron dashboard con datos reales, topbar, tarjetas compactas y gráfica; incidencias carga sin errores de consola. El servidor dev requirió reinicio porque el bind mount de Windows no propaga el file-watching de Turbopack.
- Límites: F4 continúa TESTING, no VERIFIED. La gráfica se deriva exclusivamente de la respuesta real de `/dashboard/recent-activity`; no se agregaron mocks. Quedan pendientes Lighthouse/E2E, auditoría WCAG manual y revisión de todos los breakpoints. Siguiente: commit/push de este ajuste y PR a `develop`.

### TC-SESSION-20261127-I3-034
- Fecha: 2026-11-27 21:50Z, I-3 en `redesign/frontend-platform-wt` (worktree). Continuación de lo pendiente del rediseño: accesibilidad, verificación responsive, pruebas y PR. Sin cambios de backend, contratos ni datos.
- Accesibilidad: Lighthouse sobre `/dashboard` con sesión realpasó de accesibilidad 0.98 a **1.00** y best practices **1.00**; SEO 0.80 únicamente por `robots.txt` inexistente en dev (fuera del alcance de una app interna autenticada). Se corrigieron `landmark-one-main` (`<main>` en el layout), `label-content-name-mismatch` (nombre de la campana incluye el contador) y `td-has-header` (`scope="col"` y encabezado oculto `Acciones` para la columna de acciones). Contraste calculado sobre colores efectivos: mínimo 4.75:1 (icon-tile) y texto normal ≥4.68:1; orden de encabezados H1→H2 sin saltos; foco visible con outline azul y orden de tabulación sidebar → usuario → búsqueda → campana → KPIs. Detector de Impeccable → `[]`.
- Pruebas reales: `npm run test` → 2 archivos, 14 subtests OK (incidencias y formularios de inspección). `npm run test:integration` → 3/3 motores, 2/2 outbox/idempotencia, 2/2 proyección grafo/expediente, 1/1 outbox-runtime y 3/3 Jest de motores; requirió compilar `@tracechain/contracts` antes y usar el entorno real de los contenedores con `host.docker.internal` sustituido por `localhost`. `typecheck`, `lint` y `build` del frontend → exit 0; 14 rutas generadas.
- E2E: **NOT_RUN**. No existe suite: `tests/e2e/2e2.txt` está vacío y no hay `playwright.config.*`; el script `test:e2e` no tiene pruebas que ejecutar. No se inventó cobertura E2E. La verificación responsive se realiza con Chromium aislado de Playwright en 1440/768/390, fuera del repositorio; resultado se registrará al completar.
- Responsive real: Chromium aislado de Playwright (fuera del repo) capturó `/dashboard` a 1440×900, 768×1024 y 390×844 con sesión real. Hallazgo corregido: `.workspace-main` usaba una pista `auto` con min-content de 791px, generando `scrollWidth=807` en móvil/tablet; se fijó `grid-template-columns: minmax(0, 1fr)`, `min-width:0` en sidebar/panel. Resultado final: `scrollWidth == innerWidth` en las tres resoluciones, 4/2/1 columnas de KPI, sidebar sticky/franja superior según breakpoint, tabla con scroll interno y console sin errores. Capturas: `dashboard-{desktop-1440,tablet-768,mobile-390}.png` en temp de OpenCode.
- Límites: F4 continúa TESTING, no VERIFIED. La navegación móvil es una franja desplazable horizontalmente; no se implementó menú hamburguesa para no ampliar el alcance. Commits `4f8be12` y `f00c2a1` publicados en `redesign/frontend-platform-wt`; PR #22 abierto a `develop` (https://github.com/EdwarDa2/TraceChain/pull/22) vía API de GitHub (`gh` no disponible). Siguiente: revisión humana de dueños de módulos y CI del PR; no se declara merge ni aceptación.

### TC-SESSION-20261128-I3-035
- Fecha: 2026-11-28, I-3 en `fix/f5-closure` desde `develop` (`4105962`, merge de PR #22 con check `verify` success a las 03:25Z). Usuario pidió describir el flujo final y cerrar lo pendiente de F5. Sin cambios de backend, contratos, reglas ni resultados experimentales; la autorización para cerrar documentación y E2E es explícita.
- Cambios: suite Playwright en `frontend/e2e` (19 pruebas: auth, 10 rutas, dashboard, búsqueda, permisos por rol y trazabilidad real) con sesión compartida por worker porque el backend limita 5 logins/minuto; `playwright.config.ts` con resultados fuera de `frontend` para no disparar HMR; `.gitignore` actualizado. Se corrigieron dos bugs funcionales detectados por E2E: `api()` devolvía el contenido de `data` y las vistas de lista esperaban el envelope `{data,meta}` (nuevo `useApiResponse`), y la consulta `forward/backward/genealogy` se enviaba por POST a rutas GET (ahora `method:'GET'`). Se corrigió además “Alcance potential” → “potencial”.
- DEMO-01: `tests/integration/demo150-seed.integration.mjs` exporta manifiesto y oráculo cuando se define `DEMO150_ARTIFACTS_DIR`; ejecución real 1/1 OK sobre PostgreSQL/MongoDB/Neo4j con 150 lotes, 60 órdenes, 40 distribuciones, 80 inspecciones, 10 incidencias, 279 nodos y 540 relaciones. Artefactos versionados en `tests/fixtures/demo/ampliada/manifest.json` y `expected-results.json`. `docs/pruebas/demo150-actual.json` actualizado con cobertura E2E y sin DA-08 como no ejecutado.
- Documentación: `README.md` completo, `docs/pruebas/acceptance-matrix.md` con trazabilidad RF/RN a evidencia, PROGRESS §2/§3/§5/§6/§9/§11 actualizados con merge, CI y pruebas reales.
- Verificación real: `typecheck`, `lint` y `build` del frontend → exit 0, 14 rutas; E2E → 19/19 en 44 s contra API real; semilla DEMO-150 → 1/1 OK; CI `verify` del merge → success. Sin errores de consola en las pruebas.
- Límites: la aceptación humana de DA-01..08, la ratificación de D-001/D-003, la repetición de DEMO-150 en entorno limpio con UUID oficiales, el PR `develop→main` y el tag `v1.0.0` siguen pendientes; no se declaran VERIFIED ni release. Commits `06925c4` y `2834fb1` publicados en `fix/f5-closure`; PR #23 abierto a `develop` (https://github.com/EdwarDa2/TraceChain/pull/23), check `verify` en ejecución al consultar.

### TC-SESSION-20261128-I3-036
- Fecha: 2026-11-28, I-3 en `fix/f5-closure`. Usuario solicitó auditoría funcional v1.1 y distinción explícita entre producto final, fixture canónico, DEMO-150 y escenarios experimentales. ZIP adjunto verificado: los siete documentos son idénticos a los del repo salvo `PROGRESS.md`. Sin cambios de contratos, modelos, reglas ni algoritmos.
- Hallazgos: (A-01) altas de catálogos no emitían eventos al outbox, por lo que Neo4j no conocía proveedores/productos nuevos y el primer lote recibido fallaba de forma permanente bloqueando la cola; (A-02) `scripts/seed-dev.mjs` insertaba códigos OP/DIST sin avanzar las secuencias, provocando colisión en producción/distribución dinámica tras cargar DEMO; (A-03) backend de desarrollo con `OUTBOX_ENABLED=false` (configuración del entorno, consumidor existe y arranca con `true`); (A-04) faltaban validadores y plantillas en el entorno de desarrollo. No se encontraron valores DEMO en servicios de negocio ni UI: las coincidencias están confinadas a `*.spec.mts`, fixtures y scripts de carga.
- Correcciones: `backend/src/modules/queries/read.service.ts` escribe catálogo y evento en la misma transacción SQL con el payload que exige `applyGraphEvent`; `scripts/seed-dev.mjs` sincroniza `codigo_op_seq` y `codigo_dist_seq`; `frontend/vitest.config.ts` excluye `e2e/**` de Vitest; README documenta outbox activo y carga independiente de validadores/plantillas; nueva prueba E2E de alta de proveedor por UI.
- Verificación real: flujo `AUD-*` con proveedor/productos/ubicaciones nuevos → recepción 50.000 KG, producción 10.000 KG → 20.000 UNIDAD, distribución 5.000, inspección, incidencia, trazabilidad `COMPLETO` con el lote nuevo, impacto `COMPLETO` (2 lotes/1 destino), dashboard 40/25/2 y outbox 36 completos/0 pendientes/0 fallidos. E2E → 20/20; typecheck/lint/build de backend y frontend → exit 0; `npm run test` → 14 subtests OK; integración → todas las suites OK. Informe en `docs/pruebas/functional-audit-v1.1.md` y evidencia en `docs/pruebas/audit-dynamic-actual.json`.
- Límites: los registros `AUD-*` permanecen en la base aislada (no se borraron datos); siguen pendientes la aceptación humana de DA-01..08, la revisión de dueños y el release. CI del PR #23 en `in_progress` al consultar; no se declara verde.

### TC-SESSION-20261128-I3-037
- Fecha: 2026-11-28, I-3 en `fix/incident-form-origin-lot` desde `develop` (`1e52a8b`, PR #23 fusionado con CI success). Usuario reportó que el formulario “Abrir investigación” no funcionaba.
- Reproducción: sesión de analista real, `/incidents`, el desplegable “Lote origen” mostraba únicamente “Seleccionar…”. Causa: la lista se construía solo con lotes de inspecciones `NO_CONFORME`; el backend permite incidencias con cualquier lote existente y sin inspección (RF-20, `IncidentWriteService.create`).
- Corrección: `frontend/src/app/(dashboard)/incidents/page.tsx` obtiene lotes de `GET /lots?limit=100`, muestra códigos en el selector, mantiene la inspección como opcional, limpia el formulario tras el alta y muestra el código creado. Nueva prueba E2E que crea una incidencia sin inspección; ajuste de reintento en la navegación E2E.
- Verificación real: `typecheck`, `lint` y `build` del frontend → exit 0; `npm run test:e2e` → 21/21 contra API real. Sin cambios de backend, contratos ni reglas.
- Límites: la incidencia creada por la prueba permanece en la base aislada; no se borraron datos. Commit `f370b1c` publicado; PR #24 abierto a `develop` (https://github.com/EdwarDa2/TraceChain/pull/24). Aceptación humana y release siguen pendientes.

### Plantilla para nueva sesión (copiar al final, no contar como trabajo)
- ID único: TC-SESSION-YYYYMMDD-Ix-NNN
- Fecha/hora UTC, integrante, rama, Issue/tarea, commit/PR si existe:
- Objetivo y RF/RN:
- Trabajo realizado y estado anterior → nuevo:
- Archivos modificados:
- Pruebas reales: comando, entorno, resultado, evidencia o NOT_RUN + motivo:
- Bloqueadores, dependencias y decisiones aprobadas:
- Próxima acción concreta y responsable:

## 11. Próximo punto de control
F5: el equipo revisa `docs/pruebas/acceptance-matrix.md` y ejecuta la aceptación humana de DA-01..08; I-1 e I-2 revisan las features tocadas en PR #22; se repite DEMO-150 en entorno limpio con los UUID del manifiesto; se ratifican D-001/D-002/D-003; luego se abre PR `develop→main` y, solo tras aprobación, se etiqueta `v1.0.0`. CI `verify` de `develop` ya está en success. Antes de cada tarea, comprobar dependencias y actualizar estado; al cerrar sesión, actualizar §3..9 y añadir registro §10. No modificar porcentajes sin evidencia.
