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
| BASE-03 | F0 | I-2 | Incorporar siete documentos, revisar especificación con equipo, crear Issues | — | IN_PROGRESS | Siete documentos copiados a raíz y plan `docs/plan-ejecucion-i2.md` en rama `docs/incorporar-reglas-i2`; commit `8443f77`. Pendiente revisión del equipo, ratificación D-002 e Issues (sin `gh` en este entorno) |
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
- Rama actual: por verificar. Último commit: por verificar.
- Siguiente: BASE-01; coordinar inicialización y interfaces con equipo.
- Estado: ningún trabajo de código verificado. Bloqueadores: verificar repositorio y herramientas locales.
- Archivos recientes / pruebas / PR: ninguno registrado.

### I-2 MongoDB / calidad / documentación
- Rama actual: `docs/incorporar-reglas-i2`, creada desde `develop` (alineada con `origin/develop`, 0/0). Último commit verificado al redactar: `8443f77` (incorporación de línea base y plan); `e847c92` (gitignore).
- Siguiente: cerrar BASE-03 con la revisión del equipo, ratificación D-002 y creación de Issues; luego DOC-01 cuando BASE-02 y BASE-05 estén verificadas. Plan detallado en `docs/plan-ejecucion-i2.md`.
- Estado: siete documentos incorporados a la raíz y plan de ejecución I-2 propuesto; código documental no verificado. No se marcan tareas como VERIFIED ni MERGED.
- Dependencias: I-1 LotReader/ProductReader/IncidentWriter/BlockWriter/OutboxWriter y repos SQL (REL-02/03/06); I-3 TraceabilityReader y verifyDescendant (GRA-03/05); coordinación BASE-05/06, BASE-04 para UI.
- Archivos recientes / pruebas / PR: siete Markdown en raíz, `docs/rol-i2.md` y `docs/plan-ejecucion-i2.md`. Pruebas de software: NOT_RUN (sin bootstrap ni scripts, PROJECT §6). PR: pendiente; `gh` no disponible en este entorno.

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
