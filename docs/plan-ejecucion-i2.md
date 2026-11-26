# Plan de ejecución I-2 — MongoDB / Calidad / Documentación

**Versión:** propuesta 1.0 · **Fecha:** 2026-11-26 · **Rama:** `docs/incorporar-reglas-i2`
**Responsable:** I-2 (desarrollador documental) · **Estado:** propuesta para revisión del equipo.

Este documento **no modifica** los siete documentos base, no crea RF/RNF/RN nuevos y no es evidencia de implementación. Regla aplicable: ante contradicción se bloquea el cambio afectado y se comunica (AI-15); los cambios de contrato, esquema o arquitectura requieren acuerdo (AI-03, AI-04, AI-20).

## 1. Fuentes y rol

Fuentes oficiales (línea base v1.1, con AGENTS / BUSINESS_RULES / API_CONTRACT v1.0 según D-002): `AGENTS.md`, `PROJECT.md`, `REQUIREMENTS.md`, `BUSINESS_RULES.md`, `DATA_MODEL.md`, `API_CONTRACT.md`, `PROGRESS.md`. Prompt de rol: `docs/rol-i2.md`.

I-2 es dueño de `database/document/**`, `backend/src/database/mongodb/**`, los módulos `inspection-templates`, `inspections`, `quality`, `incidents`, `lot-blocks`, `backend/src/integration/handlers/mongodb/**`, las features frontend `inspections`/`incidents` (salvo impacto) y coordina la consolidación documental. Consume interfaces de I-1 (`LotReader`, `ProductReader`, `IncidentWriter`, `BlockWriter`, `OutboxWriter`, `TransactionManager`, repositorios SQL) y de I-3 (`TraceabilityReader`, `verifyDescendant`). Provee `QualityReader` al análisis de impacto. No altera esquemas PostgreSQL ni Neo4j, no duplica servicios ajenos y no agrega colecciones (RN-97..99, AI-04, AI-10).

## 2. Estado observado del repositorio (evidencia real, 2026-11-26)

Antes de planificar se inspeccionó rama, Git, archivos y pruebas, sin confiar solo en `PROGRESS.md`:

- Remoto: `origin https://github.com/EdwarDa2/TraceChain.git`. `develop` y `origin/develop` están alineados (`0 0`); `main` está un commit atrás. Rama de trabajo creada desde `develop`: `docs/incorporar-reglas-i2`.
- Último commit observado: `11a1dbf Creacion de rama develop`; anterior: `ed955e5 Creacion de arquitectura del proyecto`.
- Los siete documentos estaban solo en `InformacionAgente/` (carpeta ahora ignorada); la raíz tenía `AGENTS.md` y los marcadores vacíos. En esta rama se copiaron a raíz y el prompt de rol a `docs/rol-i2.md`.
- `README.md` tiene 44 bytes (solo el título y una nota de rama). `backend/Dockerfile` contiene `##dockerfile`. El resto de archivos listados en el árbol canónico están vacíos o son marcadores `.txt`.
- `gh` no está disponible en este entorno: no se pudieron verificar ni crear GitHub Issues/Projects ni abrir un PR por CLI. La propuesta de Issues de §7 queda pendiente de acceso.
- Ninguna prueba de software ejecutada; `PROGRESS.md` registra todas las suites como `NOT_RUN` y 0/42 tareas verificadas o integradas. **No se suben porcentajes ni se marca VERIFIED sin evidencia.**

## 3. Qué nos hace falta (análisis de brechas)

| Artefacto | Estado observado | Dueño | Bloquea | Acción propuesta |
|---|---|---|---|---|
| Siete documentos en raíz | Incorporados en esta rama; ratificación del equipo pendiente | I-2 (BASE-03) | BASE-05, F0 | Revisar v1.1 con el equipo; crear Issues; no cambiar contratos sin acuerdo |
| `package.json`, lockfile, `.nvmrc`, `.editorconfig`, `.env.example`, `docker-compose.yml` | Vacíos o ausentes | I-1 (BASE-01/02) | Bootstrap, motores, CI | Ejecutar BASE-01/02 antes de cualquier código I-2 |
| `.github/workflows/ci.yml` | No existe; solo `.github/workflows/works.txt` vacío | I-1 | Verificación CI | Crear CI con `npm ci`, lint, typecheck, test, build, motores, migraciones y `test:integration` |
| `backend/package.json`, `backend/Dockerfile` | Vacío / marcador | I-1 | Compilación y arranque | Completar en BASE-01/02 |
| `backend/src` actual | `controllers/`, `dto/`, `services/`, `repositories/{document,graph,relational}/`, `common/`, `config/` con marcadores; **no coincide** con la estructura canónica de `PROJECT.md` §6 (módulos por dominio + `database/{postgres,mongodb,neo4j}` + `integration/{outbox,handlers/*}`) | I-1 coordina; I-2/I-3 aportan sus módulos | Organización de módulos, wiring | Acordar la migración del scaffold en PR de infraestructura; **no borrar archivos ajenos sin coordinación (AI-11)**; es decisión de arquitectura (AI-20) |
| `packages/contracts/**` | No existe | Equipo (BASE-05) | Tipos compartidos, eventos, DTO, `compile check`, todos los módulos | Definir contratos desde `API_CONTRACT.md` §2/§7/§8 antes de DOC-01 |
| `database/document/{validators,data,indexes,queries,tests}` | Cinco `.txt` vacíos | I-2 (DOC-01..04) | Persistencia documental | Sustituir por validadores, índices, plantillas y consultas reales |
| `backend/src/database/mongodb/**`, `integration/handlers/mongodb/**` | No existen | I-2 | DOC-01/05 | Crear driver y handlers de expediente/outbox |
| Módulos `inspection-templates`, `inspections`, `quality`, `incidents`, `lot-blocks` | No existen | I-2 | DOC-01..07 | Crear controller/service/repository/mapper/dto/tests por módulo |
| `frontend/src` | Solo `src.txt`; sin features `inspections`/`incidents` | I-2 tras BASE-04 (I-3) | DOC-08/09 | Implementar UI de calidad e incidencias sobre componentes compartidos |
| `database/relational/**`, repositorios SQL | Marcadores vacíos | I-1 (REL-01..03) | DOC-03/05/06/07 | Requiere `LotReader`, `ProductReader`, repos de incidencia/bloqueo, locks y versión confirmada |
| Auth, outbox, idempotencia, locks | No implementados | I-1 (REL-04/06) | DOC-03/05/06/07 | `IncidentWriter`, `BlockWriter`, `OutboxWriter` y revalidación bajo `Tx` |
| `database/graph/**`, `traceability`, `verifyDescendant` | Marcadores vacíos | I-3 (GRA-01..05) | DOC-06/07, DEMO-01/02 | Necesario para verificar descendientes antes de bloquear |
| `tests/fixtures/demo/`, `tests/benchmark/` | No existen; hay `unit/integration/e2e/performance` vacíos | Equipo (BASE-06, DEMO-01, BENCH-01) | Pruebas deterministas y evidencia | Crear manifiesto/oráculo DEMO-150 y directorio `benchmark` con acuerdo |
| `scripts/` | No existe | I-1 | Comandos de ejecución | Definir `dev`, `db:up`, `db:migrate`, `db:seed`, `test`, `test:integration`, etc. |
| GitHub Issues/Projects | No verificables sin `gh` | I-2 (BASE-03) | Seguimiento visible | Crear los issues propuestos en §7 cuando haya acceso; columnas y bloqueado visible |

## 4. Dependencias críticas para I-2

| Se necesita | De | Lo habilita |
|---|---|---|
| Workspaces, NestJS, scripts y CI (BASE-01) | I-1 | BASE-05, cualquier código y verificación |
| Docker + configuración de Mongo aislada (BASE-02) | I-1 | DOC-01, pruebas PM |
| Contratos compartidos, interfaces DI, eventos y DTO (BASE-05) | Equipo | DOC-01..07, handlers e ids de evento |
| Fixtures UUID, reloj inyectable y resultados esperados (BASE-06) | Equipo | DOC-02 (plantillas), DEMO-01, pruebas exactas |
| Esquema y lectores SQL (REL-01/02), repos de incidencia/bloqueo (REL-03) | I-1 | DOC-03, DOC-05, DOC-06, DOC-07 |
| Auth/roles y outbox/idempotencia/locks (REL-04/06) | I-1 | DOC-03, DOC-05, DOC-06 |
| Layouts y componentes (BASE-04) | I-3 | DOC-08, DOC-09 |
| `TraceabilityReader`, `verifyDescendant` (GRA-03/05) | I-3 | DOC-06, DOC-07, DEMO-02 |

Si una dependencia no existe, se registra como bloqueo; los mocks solo se usan en pruebas aisladas y donde el contrato oficial lo permita (AI-08, AI-12).

## 5. Secuencia de ejecución

Los estados son los de `PROGRESS.md` más la observación real de esta rama. `READY` no autoriza a invadir módulos ajenos.

| Orden | ID | Fase | Dueño | Estado | Dependencias | Criterio de salida |
|---|---|---|---|---|---|---|
| 1 | BASE-03 | F0 | I-2 | IN_PROGRESS (esta rama) | — | Siete documentos en raíz, revisión del equipo e Issues creados |
| 2 | BASE-01 | F0 | I-1 | READY | — | `npm ci` y build base verificables |
| 3 | BASE-02 | F0 | I-1 | PENDING | BASE-01 | Motores aislados y health degradado |
| 4 | BASE-04 | F0 | I-3 | PENDING | BASE-01 | Next.js, layouts y componentes accesibles |
| 5 | BASE-05 | F0 | Equipo | PENDING | BASE-01, BASE-03 | Tipos, interfaces DI, eventos y DTO con `compile check` |
| 6 | BASE-06 | F0 | Equipo | PENDING | BASE-05 | Fixtures UUID, reloj y resultados esperados |
| 7 | DOC-01 | F1 | I-2 | PENDING | BASE-02, BASE-05 | 3 colecciones, validadores e índices; PM-07/12 |
| 8 | DOC-02 | F1 | I-2 | PENDING | DOC-01, BASE-06 | 6 plantillas v1, selección e historial; PM-01/02/11/23 |
| 9 | DOC-03 | F2 | I-2 | PENDING | DOC-02, REL-02, REL-04 | Validación dinámica, inspecciones inmutables, idempotencia; PM-03..10/23 |
| 10 | DOC-04 | F2 | I-2 | PENDING | DOC-03 | Consultas, agregaciones y `QualityReader`; PM-17/18 |
| 11 | DOC-05 | F3 | I-2 | PENDING | DOC-04, REL-03, REL-06 | Repositorio de expediente con CAS y handlers Mongo; PM-12..16 |
| 12 | DOC-06 | F3 | I-2 | PENDING | DOC-05, GRA-03 | Incidencias crear/consultar/actualizar/iniciar/cerrar; PM-19..22 |
| 13 | DOC-07 | F3 | I-2 | PENDING | DOC-06, GRA-05, REL-03 | Bloquear/liberar con verificación en grafo; TP-17, PI-08 |
| 14 | DOC-08 | F4 | I-2 | PENDING | DOC-04, BASE-04 | UI inspecciones, formulario dinámico, detalle e indicadores |
| 15 | DOC-09 | F4 | I-2 | PENDING | DOC-07, BASE-04 | UI incidencias, expediente, bloqueos y vínculo a impacto |
| 16 | TEST-02 | F5 | I-2 | PENDING | DOC-08, DOC-09 | PM completos, matriz RF/RN y evidencia real |
| 17 | DEMO-01 | F5 | Equipo (I-2: calidad) | PENDING | REL-09, DOC-06, GRA-04, BASE-06 | DEMO-150 por servicios/outbox, manifiesto y oráculo; DA-01 |
| 18 | DEMO-02 | F5 | Equipo (I-2: investigación) | PENDING | DEMO-01, GRA-07, DOC-09, REL-12 | DA-02..07 con evidencia |
| 19 | TEST-04 | F5 | Equipo | PENDING | TEST-01/02/03, DEMO-02 | PI, E2E, fallos, accesibilidad, CI y aceptación |
| 20 | BENCH-01 | F5 | Equipo | PENDING | TEST-01, TEST-03, BASE-06 | QE-01..05, casos base y volumen fijo, CSV/JSON reales, DA-08 |
| 21 | RELSE-01 | F5 | Equipo | PENDING | TEST-04, BENCH-01 | README, informe, revisión, PR `develop→main` y tag si aprobado |

Regla de arranque: I-2 puede avanzar en paralelo solo con BASE-03, revisión documental y diseño de validadores/plantillas; **no inicia DOC-01 hasta que BASE-02 y BASE-05 estén verificadas**, ni DOC-03 sin los repositorios SQL y auth de I-1.

## 6. Detalle de tareas I-2

Para todas: actualizar `PROGRESS.md` (sección I-2 e historial) al cerrar la sesión; ejecutar y registrar comandos reales; no marcar VERIFIED sin evidencia; PR con revisor humano distinto del autor. Los comandos citados son los previstos en `PROJECT.md` §6 y **no existen aún** hasta BASE-01; se registrarán `NOT_RUN` con motivo hasta ejecutarlos.

### DOC-01 — Colecciones y validadores
- RF/RN: RNF-10, RN-107, `DATA_MODEL.md` §3. Pruebas PM-07, PM-12.
- Archivos: `database/document/validators/**`, `database/document/indexes/**`, `backend/src/database/mongodb/**`.
- Criterio: `plantillas_inspeccion`, `inspecciones_calidad`, `expedientes_incidencias` con `$jsonSchema` strict/error, `additionalProperties:false`, `_id` UUID string, límites 30 parámetros / 30 hallazgos / 20 evidencias / 50 inspecciones referenciadas y unicidades `UQ(codigo,version)`, `UQ(producto_id)` parcial activa, `UQ(codigo)`, `UQ(inspector_id,idempotency_key)`, `UQ(incidencia_id)`. Sin colecciones nuevas.

### DOC-02 — Seis plantillas v1
- RF-16, RN-51..54/115, PM-01/02/11/23.
- Archivos: `database/document/data/**`, `backend/src/modules/inspection-templates/**`.
- Criterio: TPL-HARINA, TPL-AZUCAR, TPL-MASA, TPL-PAN, TPL-GALLETAS y TPL-GENERAL con los parámetros exactos de `DATA_MODEL.md` §3, todos requeridos, sin límites sanitarios; preferencia de específica activa sobre general; historial inmutable por código+versión; plantilla inactiva rechazada para nueva inspección.

### DOC-03 — Inspecciones y validación dinámica
- RF-16..18, RN-49..58/115/119, PM-03..10/23.
- Archivos: `backend/src/modules/inspections/**`.
- Criterio: parámetros tipados contra la versión de plantilla, sin claves extra, BSON Decimal128 para decimales, no conforme exige hallazgo, inspecciones inmutables, `INS-<UUID>`, índice inspector/clave, replay por hash canónico tras auth y resolución de `duplicate key` leyendo al ganador. Sin inferencia automática de conformidad ni incidencia/bloqueo.

### DOC-04 — Consultas, agregaciones y `QualityReader`
- RF-19, RN-127, QM-02..08, PM-17/18.
- Archivos: `database/document/queries/**`, `backend/src/modules/quality/**`, interfaz `QualityReader` en contratos.
- Criterio: resumen y tasa por producto (conteo 0 y porcentaje `null` sin inspecciones), hallazgos agrupados por tipo y severidad contando elementos de arrays; `QualityReader` con `inspection`, `inspectionsByIds`, `summarizeLots` y `dossier`; nombres de producto desde PostgreSQL.

### DOC-05 — Expediente y handlers Mongo
- RF-20/22/34, RN-63/116, PM-12..16.
- Archivos: `backend/src/integration/handlers/mongodb/**`, `backend/src/modules/incidents/**` (repositorio de expediente).
- Criterio: escritura solo por handler, `version=1`, `expectedVersion` obligatorio, CAS por `incidencia_id`+versión, `$inc` atómico, `ultimo_evento_id`, replay sin duplicar, referencias validadas antes de aceptar, 503 si Mongo/Neo requerido falla; confirmación SQL y ACK en la misma transacción corta.

### DOC-06 — Flujo funcional de incidencias
- RF-20..23, RN-59..68/117, PM-19..22.
- Archivos: `backend/src/modules/incidents/**`.
- Criterio: crear con/sin inspección previa, estado ABIERTA→EN_ANALISIS→CERRADA bajo lock, cierre exige resolución y expediente `SINCRONIZADO`, sin reapertura, cierre sin evento Mongo; endpoints según `API_CONTRACT.md` §3 con `Idempotency-Key`.

### DOC-07 — Bloqueo y liberación
- RF-31/32, RN-87..96/118, TP-17, PI-08.
- Archivos: `backend/src/modules/lot-blocks/**`.
- Criterio: 1..100 lotes distintos, raíz o descendiente verificado por I-3, todo o nada, justificación, máximo un bloqueo activo por lote/incidencia, retiro individual con motivo, cierre no libera, stock físico inalterado; `UNKNOWN`/grafos pendientes → 503, negativo concluyente → 422.

### DOC-08 / DOC-09 — UI de calidad e incidencias
- RF-16..23/31/32, RNF-15/16.
- Archivos: `frontend/src/features/inspections/**`, `frontend/src/features/incidents/**` (salvo ruta de impacto, que es I-3).
- Criterio: formulario dinámico por plantilla, estados carga/vacío/error/parcial, listados paginados, expediente y bloqueos, confirmación antes de mutaciones, alternativa textual al grafo, mensajes en español y foco/teclado accesibles.

### TEST-02 — Evidencia documental
- Archivos: `database/document/tests/**`, `tests/unit/**`, matriz RF/RN en `docs/pruebas/**`.
- Criterio: PM-01..23 ejecutados con comando, fecha, entorno y resultado real; matriz RF/RN actualizada; sin resultados inventados.

## 7. Propuesta de GitHub Issues (pendiente de creación; `gh` no disponible)

Títulos propuestos, no IDs inventados. Columnas: Pendiente, Lista, En progreso, En revisión, En pruebas, Completada; bloqueado visible. La issue incluye ID, dueño, objetivo, RF/RN, archivos, dependencias, criterios y pruebas. Revisión: otro integrante para módulo propio; ambos otros integrantes para contratos/modelo compartido.

| Propuesta | Dueño | Objetivo / RF-RN | Dependencias |
|---|---|---|---|
| `I2-BASE-03` | I-2 | Siete docs en raíz, revisión v1.1 e Issues | — |
| `EQ-BASE-05` | Equipo | Tipos, interfaces DI, eventos y DTO | BASE-01, BASE-03 |
| `EQ-BASE-06` | Equipo | Fixtures UUID, reloj y esperados | BASE-05 |
| `I2-DOC-01` | I-2 | Colecciones, validadores e índices / RNF-10 | BASE-02, BASE-05 |
| `I2-DOC-02` | I-2 | Seis plantillas v1 / RF-16 | DOC-01, BASE-06 |
| `I2-DOC-03` | I-2 | Inspecciones e idempotencia / RF-17, RN-119 | DOC-02, REL-02, REL-04 |
| `I2-DOC-04` | I-2 | Agregaciones y `QualityReader` / RF-19 | DOC-03 |
| `I2-DOC-05` | I-2 | Expediente CAS y handlers / RF-34 | DOC-04, REL-03, REL-06 |
| `I2-DOC-06` | I-2 | Incidencias y estados / RF-20..23 | DOC-05, GRA-03 |
| `I2-DOC-07` | I-2 | Bloqueos verificados / RF-31/32 | DOC-06, GRA-05, REL-03 |
| `I2-DOC-08` | I-2 | UI inspecciones / RF-16..19 | DOC-04, BASE-04 |
| `I2-DOC-09` | I-2 | UI incidencias / RF-20..23 | DOC-07, BASE-04 |
| `I2-TEST-02` | I-2 | PM y matriz RF/RN | DOC-08, DOC-09 |
| `EQ-DEMO-01/02` | Equipo | DEMO-150 y DA-01..07 (I-2: calidad e investigación) | REL-09, DOC-06, GRA-04/07, DOC-09 |

## 8. Punto de control y Definition of Done

Antes de cada tarea: leer los siete documentos, comprobar `git status`/`log`/pruebas, elegir tarea READY autorizada, marcar IN_PROGRESS y rama en la sección I-2 de `PROGRESS.md`. Después de cada sesión: actualizar tareas, RF/endpoints/artefactos, pruebas reales (comando, fecha UTC, éxito/fallo/no ejecutada y motivo), bloqueos, decisión aprobada y siguiente acción; agregar **una** entrada al historial §10 sin borrar historia.

DoD: RF/RN satisfechos, contrato respetado, entradas y permisos validados, transacciones y fallos cubiertos, regresiones probadas, lint/tipos/build aplicables, documentación actualizada, sin secretos ni datos reales, PR aprobado y merge confirmado. `IMPLEMENTED ≠ VERIFIED ≠ MERGED`. Porcentajes solo desde tareas verificadas/integradas.

## 9. Riesgos e inconsistencias reportadas (no resueltas unilateralmente)

1. **B-001:** el repositorio fue inspeccionado por I-2 en esta sesión (rama, commit, árbol y pruebas), pero el bootstrap de I-1 sigue pendiente; no se da por resuelto.
2. **B-002:** nombres oficiales de I-1/I-3, credenciales y revisores pendientes de confirmación.
3. **B-003:** parches exactos del stack e identidad visual pendientes.
4. **Estructura del scaffold:** `backend/src` usa `controllers/services/repositories` en lugar de la estructura canónica; reordenarlo es cambio arquitectónico y requiere acuerdo con I-1 (AI-11, AI-20). No se borraron marcadores ajenos.
5. **Sin `gh`:** no se crearon Issues ni PR; el push de esta rama no sustituye la revisión humana ni la aprobación del equipo.
6. **Versiones:** PROJECT/DATA_MODEL/REQUIREMENTS/PROGRESS v1.1 y AGENTS/BUSINESS_RULES/API_CONTRACT v1.0 por D-002; no alinear "porque sí" sin aprobación.
7. **Sin métricas:** 0/42 tareas verificadas; no se reporta avance de código ni beneficio de Neo4j como hecho.

## 10. Próxima acción concreta

1. Que el equipo ratifique este plan y los siete documentos (D-002) y confirme roles/revisores.
2. I-1 ejecuta BASE-01 y BASE-02 para habilitar contratos y Mongo aislado.
3. Con acceso a GitHub, crear las issues de §7 y vincularlas a `PROGRESS.md`.
4. I-2 prepara, sin tocar esquemas ajenos, el borrador de validadores y las seis plantillas como propuesta; inicia DOC-01 solo con BASE-02 y BASE-05 verificadas.
5. Al cierre de cada sesión, aplicar el punto de control de §8.
