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
| F4 UI | PENDING | 14 vistas con API real | — |
| F5 Entrega | PENDING | Tests, demo ampliada DA-01..08, benchmark, documentación, release | — |

## 3. Backlog base (IDs locales; vincular Issue real cuando exista)
Cada fila tiene un resultado verificable. Estado READY inicial solo para tareas de bootstrap/documentación que no necesitan código previo; confirmar repo real antes de iniciar. Los demás PENDING hasta dependencia satisfecha. Si un contrato permite mock, registrar explícitamente qué parte se verifica aislada; no marcar integración como completada. Los RF se detallan en REQUIREMENTS; dependencias indican tareas mínimas, no autorización para alterar módulos. Evidencia se registra en sesión y PR, no inventar IDs de GitHub.

| ID | Fase | Dueño | Tarea y criterio de aceptación | Depende de | Estado | Evidencia/PR |
|---|---|---|---|---|---|---|
| BASE-01 | F0 | I-1 | Inicializar workspaces, NestJS, scripts, CI y git; npm ci/build base | — | READY | — |
| BASE-02 | F0 | I-1 | Docker y configuración; motores aislados y health degradado | BASE-01 | PENDING | — |
| BASE-03 | F0 | I-2 | Incorporar siete documentos, revisar especificación con equipo, crear Issues | — | READY | — |
| BASE-04 | F0 | I-3 | Inicializar Next.js, layouts, componentes y guía visual accesible | BASE-01 | PENDING | — |
| BASE-05 | F0 | Equipo | Tipos compartidos, interfaces DI, eventos y DTO, compile check | BASE-01, BASE-03 | PENDING | — |
| BASE-06 | F0 | Equipo | Fixtures UUID, reloj, harness y resultados esperados comunes | BASE-05 | PENDING | — |
| REL-01 | F1 | I-1 | Migraciones 16 tablas + registro, constraints, índices y vistas | BASE-02, BASE-05 | PENDING | — |
| REL-02 | F1 | I-1 | Lectores de lote/producto/stock/incident/blocks y Tx compartida | REL-01 | PENDING | — |
| REL-03 | F1 | I-1 | Repositorios SQL incidencia/bloqueo + locks y versión confirmada | REL-02 | PENDING | — |
| DOC-01 | F1 | I-2 | 3 colecciones strict/error e índices; PM-07/12 | BASE-02, BASE-05 | PENDING | — |
| DOC-02 | F1 | I-2 | 6 plantillas v1 y selección/historial; PM-01/02/11 | DOC-01, BASE-06 | PENDING | — |
| GRA-01 | F1 | I-3 | 6 etiquetas/7 relaciones constraints e índices | BASE-02, BASE-05 | PENDING | — |
| REL-04 | F2 | I-1 | Auth, roles y throttling; PS-01..12 aplicables | REL-01 | PENDING | — |
| REL-05 | F2 | I-1 | Catálogos completos; reactivación y restricciones históricas | REL-02, REL-04 | PENDING | — |
| REL-06 | F2 | I-1 | Outbox, idempotencia, locks y retry; pruebas recuperación | REL-01, BASE-05 | PENDING | — |
| REL-07 | F2 | I-1 | Recepciones, stock y movimientos; TP-03..05 | REL-05, REL-06 | PENDING | — |
| REL-08 | F2 | I-1 | Producción atómica y concurrencia; TP-06..11/16/23 | REL-07 | PENDING | — |
| DOC-03 | F2 | I-2 | Validación dinámica, inspecciones inmutables e idempotencia; PM-03..10/23 | DOC-02, REL-02, REL-04 | PENDING | — |
| DOC-04 | F2 | I-2 | Consultas, agregaciones y QualityReader; PM-17/18 | DOC-03 | PENDING | — |
| GRA-02 | F2 | I-3 | Handlers catálogo/recepción/producción idempotentes; PG-01..04 | GRA-01, REL-06 | PENDING | — |
| GRA-03 | F2 | I-3 | BFS adelante/atrás/genealogía, niveles y advertencias; PG-05..07/13 | GRA-02, REL-08 | PENDING | — |
| REL-09 | F3 | I-1 | Distribución transaccional y movimientos; TP-12/13 | REL-08 | PENDING | — |
| REL-10 | F3 | I-1 | Dashboard API, actividad, estado sync; conteos fixture | REL-03, REL-09 | PENDING | — |
| DOC-05 | F3 | I-2 | Dossier repositorio, CAS, handlers Mongo; PM-12..16 | DOC-04, REL-03, REL-06 | PENDING | — |
| DOC-06 | F3 | I-2 | Incidencias crear/consultar/actualizar/iniciar/cerrar; PM-19..22 | DOC-05, GRA-03 | PENDING | — |
| GRA-04 | F3 | I-3 | Distribución proyectada y destinos históricos; PG-11 | GRA-02, REL-09 | PENDING | — |
| GRA-05 | F3 | I-3 | Comunes/caminos, caps, verificación descendiente; PG-08..10/21 | GRA-03 | PENDING | — |
| DOC-07 | F3 | I-2 | Bloquear/liberar con SQL y verificación grafo; TP-17/PI-08 | DOC-06, GRA-05, REL-03 | PENDING | — |
| GRA-06 | F3 | I-3 | Impacto integrado y mapeo visual; PI-07/10 | GRA-04, GRA-05, DOC-05, DOC-06, REL-02 | PENDING | — |
| REL-11 | F3 | I-1 | Detalle lote integrado QI-01; PI-09 | DOC-04, GRA-03, REL-02 | PENDING | — |
| REL-12 | F4 | I-1 | 8 vistas/secciones operativas, login, inventario/producción/distribución | REL-11, REL-09, BASE-04 | PENDING | — |
| DOC-08 | F4 | I-2 | UI inspecciones, formulario dinámico, detalle, indicadores | DOC-04, BASE-04 | PENDING | — |
| DOC-09 | F4 | I-2 | UI incidencias, expediente, bloqueos, vínculo a impacto | DOC-07, BASE-04 | PENDING | — |
| GRA-07 | F4 | I-3 | GraphViewer, explorador accesible, impacto, dashboard UI | GRA-06, REL-10, BASE-04 | PENDING | — |
| TEST-01 | F5 | I-1 | TP y PS completos, SQL benchmark queries, evidencia | REL-12, DOC-07 | PENDING | — |
| TEST-02 | F5 | I-2 | PM completos, evidencia documental y matriz RF/RN | DOC-08, DOC-09 | PENDING | — |
| TEST-03 | F5 | I-3 | PG completos y Cypher benchmark queries | GRA-07 | PENDING | — |
| DEMO-01 | F5 | Equipo | Generar DEMO-150 por servicios/outbox, manifiesto y oráculo, validar conteos DA-01; I-1 datos/stock, I-2 calidad, I-3 grafo | REL-09, DOC-06, GRA-04, BASE-06 | PENDING | — |
| DEMO-02 | F5 | Equipo | Ejecutar DA-02..07 y documentar evidencia; I-3 recorridos/UI, I-2 investigación, I-1 inventario/recuperación | DEMO-01, GRA-07, DOC-09, REL-12 | PENDING | — |
| TEST-04 | F5 | Equipo | PI, E2E, fallos/recuperación, accesibilidad, CI y aceptación | TEST-01, TEST-02, TEST-03, DEMO-02 | PENDING | — |
| BENCH-01 | F5 | Equipo | Generador y QE-01..05 equivalentes, casos base + volumen fijo/topologías, métricas reales CSV/JSON y DA-08 | TEST-01, TEST-03, BASE-06 | PENDING | — |
| RELSE-01 | F5 | Equipo | README, informe, revisión final, PR develop→main y tag si aprobado | TEST-04, BENCH-01 | PENDING | — |

Total línea base v1.0: 40 tareas. Total línea base v1.1 (2026-11-25): 42 tareas, dos nuevas DEMO-01/02. 0/42 VERIFIED o MERGED, 0/42 MERGED según este checkpoint documental; estado real del repo por verificar. No son estimaciones de horas.

## 4. Checkpoint por integrante (editar solo sección propia)
### I-1 PostgreSQL / operaciones / infraestructura
- Rama actual: `feature/pg-bootstrap`, creada desde `develop` (`2746582`). Último commit de esta sesión: BASE-01/BASE-02.
- Siguiente: BASE-05 (contratos compartidos, coordinado) y REL-01 (16 tablas + `schema_migrations`); después REL-02/03 y auth/outbox.
- Estado: bootstrap y validación de entorno preparados con pruebas; **no hay dependencias instaladas ni motores corriendo**, por lo que BASE-01/02 no se marcan VERIFIED. Bloqueadores: B-001 sigue abierto hasta `npm ci` y arranque real.
- Artefactos: `package.json` raíz con workspaces, `backend/package.json`, `frontend/package.json`, `packages/contracts/package.json`, `tsconfig*`, `.nvmrc`, `.editorconfig`, `.prettierrc.json`, `eslint.config.mjs`, `.env.example`, `docker-compose.yml` (5 servicios, volúmenes y DB en loopback) y `.github/workflows/ci.yml`.
- Archivos recientes / pruebas / PR: `backend/src/config/env.validation.mts` y `tests/unit/bootstrap.spec.mts`. Prueba ejecutada: `node --experimental-strip-types --test tests/unit/bootstrap.spec.mts` → 9/9 OK (2026-11-26). `npm ci`, lint, typecheck, build, PM/TP/PI/E2E: NOT_RUN. PR pendiente; sin merge a `develop`.

### I-2 MongoDB / calidad / documentación
- Rama actual: documentación en `docs/incorporar-reglas-i2`; código en `feature/mongo-schema` (creada desde `develop`, sin integrar). Últimos commits verificados: `6772185` (vista de incidencias, 7 pruebas), `4830165` (formulario dinámico, 6 pruebas), `beb3e88` (bloqueo/liberación, 14 pruebas), `0f77a5f` (ciclo de incidencias, 10 pruebas), `febdcfa` (expediente CAS, 14 pruebas), `6e1c172` (agregaciones, 9 pruebas), `09a7dec` (validador, 18 pruebas), `2623222`/`290ce0b` (capa documental), checkpoints `943f37f`/`3ef30aa`/`4cb50dd`/`259ff73`/`524cd09`.
- Siguiente: **no queda trabajo de I-2 que no requiera integración**; BASE-03 sigue pendiente de revisión del equipo, ratificación D-002, Issues y decisión sobre el commit `130868b` de `develop`. Cuando BASE-01/02/04/05 estén verificadas: aplicar validadores e índices, cargar plantillas, ejecutar PM/TP/PI/E2E y migrar los `.mts` a `.ts`/`.tsx` conectando los puertos a adaptadores reales. Plan detallado en `docs/plan-ejecucion-i2.md`.
- Estado: las nueve tareas específicas de I-2 (DOC-01..DOC-09) tienen artefactos con pruebas unitarias, pero ninguna está VERIFIED ni MERGED: faltan MongoDB real, NestJS, contratos e integración. El porcentaje formal sigue en 0 % (PROGRESS §1). No se cuenta código generado como verificado.
- Artefactos de diseño (permitidos en paralelo según plan §5): tres esquemas `$jsonSchema`, diez índices, seis plantillas v1, aplicador, sembrador, `backend/src/modules/inspections/parameters.validator.mts` (18 pruebas), `backend/src/modules/quality/quality-aggregations.mts` (9 pruebas), `backend/src/modules/incidents/dossier.mts` (14 pruebas: CAS, replay, handlers y respuesta 202) , `backend/src/modules/incidents/incident-lifecycle.mts` (10 pruebas), `backend/src/modules/lot-blocks/block-service.mts` (14 pruebas: verificación de grafo, todo o nada, retiro individual), `frontend/src/features/inspections/inspection-form.mts` (6 pruebas) y `frontend/src/features/incidents/incident-view.mts` (7 pruebas). Se usa `.mts` para ejecutar con `node --experimental-strip-types` mientras `backend/package.json` y `frontend/package.json` están vacíos (I-1); se convertirá a `.ts`/`.tsx` cuando BASE-01 y BASE-04 lo habiliten.
- Dependencias: I-1 LotReader/ProductReader/IncidentWriter/BlockWriter/OutboxWriter y repos SQL (REL-02/03/06); I-3 TraceabilityReader y verifyDescendant (GRA-03/05); coordinación BASE-05/06, BASE-04 para UI.
- Archivos recientes / pruebas / PR: siete Markdown en raíz, `docs/rol-i2.md`, `docs/plan-ejecucion-i2.md`, `database/document/**`, `backend/src/modules/inspections/**`, `backend/src/modules/quality/**` y `backend/src/modules/incidents/**`. Pruebas ejecutadas (2026-11-26): `node database/document/tests/static-check.mjs` → 309 verificaciones OK; `node --experimental-strip-types --test <7 suites de backend y frontend>` → 78/78 OK (18+9+14+10+14+6+7). PM-01..23 y lint/typecheck/build: NOT_RUN (sin BASE-01/02 ni dependencias instaladas). PR: pendiente; `gh` no disponible en este entorno.
### I-3 Neo4j / trazabilidad / UX
- Rama actual: por verificar. Último commit: por verificar.
- Siguiente: coordinar BASE-04 tras BASE-01 y GRA-01 cuando esté entorno.
- Estado: ningún trabajo de código verificado. Depende de contratos/eventos I-1, QualityReader I-2 para impacto.
- Archivos recientes / pruebas / PR: ninguno registrado.

## 5. Estado RF (fuente REQUIREMENTS.md)
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
| GET /traceability/:lotId/forward | PENDING | — |
| GET /traceability/:lotId/backward | PENDING | — |
| GET /traceability/:lotId/genealogy | PENDING | — |
| POST /traceability/common-origins | PENDING | — |
| POST /traceability/paths | PENDING | — |
| GET /incidents/:id/impact | PENDING | — |
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
| Lint / typecheck / build | NOT_RUN | — |
| Accesibilidad / aceptación | NOT_RUN | — |
| QE-01..05 benchmark | NOT_RUN | — |
| DA-01..08 demo ampliada y evidencia analítica | NOT_RUN | — |

Registrar por ejecución: fecha UTC, integrante, rama/commit, entorno, comando exacto, número de tests pasados/fallidos/omitidos si disponible, duración si medida, enlace de log/PR, fallo y siguiente acción. Nunca inventar resultados. Actualizar por ID específico cuando proceda.

## 9. Bloqueadores y decisiones
| ID | Estado | Descripción | Responsable / acción |
|---|---|---|---|
| B-001 | Por verificar | No se ha inspeccionado repositorio real ni ejecutado bootstrap | I-1: verificar estructura, rama, dependencias; equipo confirmar |
| B-002 | Pendiente de coordinación | Nombres nominales de I-1 e I-3, accesos/revisores | Equipo confirmar; no bloquea diseño por rol |
| B-003 | Pendiente de coordinación | Parches exactos y compilación de stack, identidad visual | I-1 fija parches, I-3 sistema de diseño |

Registro de decisiones: D-001 línea base documental v1.0, 2026-11-25. Integra decisiones de conversaciones y cierra detalles operativos en los seis archivos de especificación. Validación de equipo y pruebas de implementación pendientes. Para nuevas decisiones: ID, fecha, propuesta, alternativas, impacto en RF/RN/API/datos, aprobación humana, PR; actualizar documentos normativos, no solo esta sección.

D-002 — revisión documental v1.1, 2026-11-25. Solicitada por el integrante 2: conservar el alcance reducido y fortalecer el papel analítico de Neo4j e integración Mongo/SQL. Alternativa descartada por ahora: añadir colecciones, etiquetas o módulos solo para aumentar tamaño. Se agrega DEMO-150 separado del fixture canónico, oráculo analítico, DA-01..08 y tareas DEMO-01/02; BENCH-01 refuerza pruebas de profundidad/topología. 40→42 tareas, RF/RNF y contratos sin cambios. Los otros tres documentos conservan contenido v1.0. Aprobación de la actualización documental por solicitante; ratificación del equipo, Issue/PR y verificación de repo pendientes. Ninguna prueba de software ejecutada.

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
F0: equipo revisa los siete documentos, confirma roles y repositorio, I-1 inicializa workspace/backend y entorno, I-3 frontend una vez disponible base, I-2 coordina documentación y contratos. Antes de implementar una tarea, comprobar dependencias y actualizar su estado. Al cierre de cada sesión, actualizar §3..9 y añadir registro §10. No modificar porcentajes sin evidencia.
