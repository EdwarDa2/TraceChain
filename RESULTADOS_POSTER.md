# Resultados provisionales para el póster — TraceChain v1.1

> **Alcance de esta evidencia (2026-11-26):** proyección y consultas Neo4j de una topología controlada inspirada en el escenario canónico. **No** es validación del escenario canónico multimodelo ni benchmark PostgreSQL vs. Neo4j. Datos enteramente ficticios; no implican contaminación confirmada.

> **Actualización de integración (2026-11-26):** una **prueba distinta**, `tests/integration/operations-http.integration.mjs`, ya ejercitó HTTP autenticado → PostgreSQL → Outbox → Neo4j y HTTP → MongoDB → incidencia SQL → Outbox → expediente MongoDB. Los conteos de las tablas §2/§5 pertenecen a la proyección aislada anterior; la integración nueva no convierte esos conteos en resultados del fixture canónico.

> **Escenario canónico (2026-11-26):** `tests/integration/canonical-operations.integration.mjs` reprodujo la topología funcional de DATA_MODEL §5 mediante servicios y Outbox reales sobre los tres motores. Es una tercera prueba, independiente de la HTTP reducida y de la proyección aislada. No corresponde a DEMO-150 ni al benchmark.

## 1. Objetivo de la evaluación
Verificar que la proyección y el recorrido productivo dirigido permitan identificar descendientes, antecedentes comunes y destinos sin propagar a lotes independientes o co-insumos.

## 2. Escenario de prueba
Una prueba de integración construye mediante los **handlers reales de eventos** Neo4j los alias de nueve lotes, cinco procesos y tres distribuciones con la topología de DATA_MODEL.md §5. Los UUID son nuevos por ejecución para no tocar datos ajenos; los códigos y conexiones conservan la topología de prueba. Incluye tres proveedores, siete productos y cuatro ubicaciones. No hay operación SQL oficial, inspecciones ni incidencia en esta prueba.

## 3. Metodología experimental
Se aplican eventos v1 en Neo4j Community, se ejecutan consultas parametrizadas con el driver y un BFS de lotes que solo sigue `Lote-[:UTILIZADO_EN]->Proceso-[:GENERA]->Lote` (o el inverso). Se cuenta cada transformación como un nivel y se deduplican UUID. Se repite la prueba en una topología pequeña adicional con ramificación/convergencia para comprobar dos caminos, replay y límite de caminos. No se midió rendimiento comparativo: QE-01..05 **NOT_RUN**.

## 4. Condiciones de ejecución
Ejecución local del 2026-11-26 en Docker de pruebas con Node.js 22.22.0, Neo4j `5.26-community`; PostgreSQL `16` y MongoDB `8.0` estuvieron disponibles, **pero no alimentaron este escenario**. El script inserta únicamente UUID propios y los elimina al terminar. Hardware, carga de trabajo concurrente y versión exacta de motor observada por consulta: **no registrados**. Los tiempos de Node TAP no son latencias de consulta ni datos comparables de benchmark.

## 5. Resultados funcionales
Valores obtenidos de Neo4j, reproducibles con `tests/integration/canonical-graph.integration.mts` y registrados en `docs/pruebas/graph-projection-actual.json`:

| Verificación en proyección aislada | Esperado | Obtenido |
|---|---:|---:|
| Nodos de los alias de prueba | 31 | 31 |
| Relaciones entre esos nodos | 35 | 35 |
| Lotes / procesos / distribuciones | 9 / 5 / 3 | 9 / 5 / 3 |
| Descendientes únicos de MP-001 | LP-001, LP-002, LP-003, LP-004 | Exactamente esos cuatro |
| Niveles mínimos | 1, 1, 2, 2 | 1, 1, 2, 2 |
| Antecedentes comunes LP-003/LP-004 | MP-001, MP-002 | MP-001, MP-002 |
| Destinos desde MP-001 y descendientes | Centro, Norte | Centro, Norte |
| Ruta MP-001→LP-003 | 2 transformaciones | 2 |
| Ruta MP-001→LP-005 | Ninguna | 0, consulta completa |
| Profundidad máxima 1 | Advertencia PARCIAL | PARCIAL/DEPTH_LIMIT |
| Límite exacto de 5 lotes con raíz | COMPLETO | COMPLETO |
| Límite de 4 lotes con raíz | PARCIAL | PARCIAL/RESULT_LIMIT |
| Subgrafo productivo de MP-001 y descendientes | Aristas reales, sin extremos huérfanos | 9 nodos / 8 aristas; sin truncamiento |
| Tope visual de 8 nodos | Truncamiento solo visual | Truncado; ninguna arista huérfana |
| Proveedores de antecedentes de LP-003 | PROV-001/002/003 | PROV-001/002/003 |
| Procesos internos del alcance MP-001 | OP-000001..000004 | OP-000001..000004 |

Distribución por relación observada: `SUMINISTRA=4`, `CORRESPONDE_A=9`, `UTILIZADO_EN=8`, `GENERA=5`, `INCLUIDO_EN=3`, `SALE_DE=3`, `ENTREGADO_A=3`. En la prueba adicional de convergencia: **2 rutas dirigidas distintas** de longitud 2 hacia un mismo lote; `maxPaths=1` devolvió PARCIAL/PATH_LIMIT; la lista de alcance incluyó el lote convergente una sola vez.

En una **prueba separada** PostgreSQL+Neo4j con esquema SQL propio y dos lotes ficticios independientes, `verifyDescendant` devolvió `YES` para el camino positivo pese a un evento Neo pendiente, `UNKNOWN` para ausencia con cola pendiente y `NO` para el lote independiente tras completar la cola. La implementación compara la secuencia Outbox antes y después; no se probó aún una inserción concurrente controlada durante la lectura. No representa una incidencia o bloqueo creado por la API.

**No verificado en este escenario de 31 nodos:** cuatro inspecciones, tres no conformes, incidencia, stock y existencias SQL, referencias UUID entre los tres motores ni una respuesta API integrada. Los conteos de calidad del documento de diseño no se reproducen aquí.

### Prueba multimodelo separada (datos ficticios temporales)

Con `tests/integration/operations-http.integration.mjs` en Node 22.22.0, PostgreSQL 16, MongoDB 8 y Neo4j 5.26 de pruebas: **1/1 OK**. Se ejecutaron login y permisos (401/403), recepción, producción, distribución, replay idempotente, inspección no conforme y creación de incidencia por HTTP; se drenaron los eventos reales mediante los handlers. Resultado observado: 1 recepción, 1 producción, 1 distribución, 8 eventos proyectados a Neo4j con 8 relaciones entre IDs de esta ejecución, 1 inspección, 1 incidencia y 1 expediente sincronizado. Una prueba SQL complementaria, `tests/integration/operations-sql.integration.mts` (**1/1 OK**), comprobó 2 lotes, 5 movimientos, 3 eventos operativos, 3 solicitudes idempotentes, saldos finales y rollback por stock insuficiente. Son **dos pruebas aisladas diferentes**: sus conteos no se suman ni equivalen al escenario canónico. Ambas usan IDs nuevos, SQL en esquema temporal y limpieza propia; la prueba HTTP usa una base Mongo temporal. Neo4j contiene únicamente las entidades de catálogo y operación generadas por esa prueba durante su ejecución.

### Prueba canónica multimodelo por servicios (tercer conjunto)

`tests/integration/canonical-operations.integration.mjs` ejecutó **1/1 OK** en PostgreSQL 16, MongoDB 8, Neo4j 5.26 y Node 22.22.0. Insertó catálogos ficticios en SQL y sus eventos en Outbox, ejecutó recepciones, órdenes y distribuciones con servicios operativos reales y proyectó los eventos por el dispatcher/handler. Cargó las seis plantillas oficiales vinculadas a los UUID temporales, registró cuatro inspecciones con el servicio documental, creó una incidencia con el servicio SQL y sincronizó su expediente por Outbox. Todo se hizo en esquema SQL y base Mongo temporales; se retiraron únicamente los UUID propios de Neo4j al finalizar.

| Aserción canónica verificada | Observado |
|---|---:|
| Lotes / órdenes / distribuciones | 9 / 5 / 3 |
| Movimientos SQL | 23 |
| Nodos / relaciones Neo4j | 31 / 35 |
| Descendientes únicos MP-001 (niveles 1/2) | 4 (2/2) |
| Antecedentes comunes LP-003/LP-004 | MP-001 y MP-002 |
| Destinos de MP-001 y descendientes | Centro y Norte; no Sur |
| Inspecciones / no conformes | 4 / 3 |
| Incidencia EN_ANALISIS / expediente sincronizado | 1 / 1 |
| Bloqueos manuales aplicados y retirados en prueba | 2 / 2; 0 activos al finalizar |
| Impacto integrado (servicio; origen MP-001) | 5 lotes / 2 destinos; calidad y expediente disponibles |
| Modalidades de trazabilidad ejecutadas | 5 (adelante, atrás, genealogía, comunes, caminos) |

Se comprobaron los 12 saldos por lote/ubicación del oráculo (incluidos 60/40 de LP-003, 50/30 de LP-004 y 40/20 de LP-005), una ruta MP-001→LP-003 de dos transformaciones y ausencia completa de ruta MP-001→LP-005. La incidencia pasó a EN_ANALISIS por servicio tras sincronizar el expediente. El impacto integrado por servicio devolvió 5 lotes (2 directos/2 indirectos), 2 destinos, 3 inspecciones no conformes y expediente; con profundidad 1 devolvió PARCIAL/DEPTH_LIMIT. Las cinco modalidades de trazabilidad se ejecutaron sobre el mismo fixture: adelante desde MP-001 (2 directos, 2 indirectos, 4 procesos, 2 destinos), atrás desde LP-003 (LP-001 nivel 1; MP-001/002/003 nivel 2; 3 proveedores), genealogía, comunes MP-001/MP-002 con profundidad por raíz, y caminos MP-001→LP-003 de profundidad 2 frente a MP-001→LP-005 sin ruta. Se rechazó un bloqueo de MP-004 independiente, se bloquearon manualmente MP-001 y LP-003, se rechazó una nueva distribución de LP-003 y se retiraron los bloqueos sin cambiar stock. Evidencia estructurada: `docs/pruebas/canonical-multimodel-actual.json`. **Límite:** el fixture canónico se ejercitó por servicios, no mediante todos los endpoints HTTP; falta la prueba de múltiples incidencias activas sobre un mismo lote. Las rutas HTTP de impacto y de las cinco modalidades de trazabilidad se probaron solo en la prueba reducida, auth, errores y parcialidad incluidos. DEMO-150 y QE-01..05 continúan **NOT_RUN**. Los tiempos TAP son duración de suite, **no** latencia experimental.

### Concurrencia y recuperación (cuarto conjunto, aislado)

`tests/integration/concurrency-sql.integration.mjs` y `tests/integration/outbox-recovery.integration.mjs` ejecutaron **2/2 OK** sobre PostgreSQL 16, MongoDB 8 y Neo4j 5.26, con esquema SQL y base Mongo temporales. En carrera, dos consumos de 70 y 50 sobre 100 unidades confirmaron solo uno y rechazaron el otro con `INSUFFICIENT_STOCK`, sin saldos negativos. Dos solicitudes idénticas con la misma clave de idempotencia devolvieron la misma respuesta y produjeron una distribución, dos movimientos y una reserva. El bloqueo y la distribución concurrentes se serializaron por lock de lote; una vez confirmado el bloqueo, la distribución posterior fue rechazada con `LOT_BLOCKED` sin modificar el stock. Dos incidencias bloquearon el mismo lote: al retirar una restricción siguió habiendo una activa y `cantidad_utilizable` permaneció en cero; solo al retirar la segunda se liberó.

En recuperación, un fallo de Neo4j dejó el evento `FALLIDO` con reintento programado mientras SQL conservaba la operación; un evento `PROCESANDO` residual se reclamó y aplicó sin saltarlo, con 4 nodos y 2 relaciones, y la reentrega no duplicó la proyección. Con MongoDB caído, la incidencia SQL quedó conservada y el expediente en `ERROR`; tras recuperar se sincronizó la versión 1 y el replay no creó otra versión. Un fallo permanente quedó `FALLIDO` sin reintento automático. Evidencia: `docs/pruebas/concurrency-recovery-actual.json`. **Límite:** el fallo se inyectó en la aplicación del evento, no apagando contenedores; no sustituye pruebas de caída de red ni reinicio.

### DEMO-150 funcional (quinto conjunto, aislado)

`tests/integration/demo150-seed.integration.mjs` ejecutó **1/1 OK**: generó por servicios y Outbox 150 lotes (30 recepciones y 120 salidas), 60 órdenes, 40 distribuciones, 350 movimientos, 159 eventos Neo, 80 inspecciones, 10 incidencias y 10 expedientes. La proyección observó exactamente **279 nodos y 540 relaciones** por tipo. D01-r1 produjo 12 descendientes en niveles 2/4/4/2; b2 y c2 compartieron tres antecedentes; r1→d1 tiene dos rutas de profundidad 3 y r1→f1 camino mínimo 4; no existe ruta a D02-f1. El impacto de la incidencia D01 devolvió 13 lotes, cuatro destinos y stock D01-f1 de 28/8/4 sin doble conteo. La profundidad 1 devolvió PARCIAL, y un bloqueo manual verificado impidió la distribución; el cierre no liberó el bloqueo. Evidencia: `docs/pruebas/demo150-actual.json`. **Límite:** semilla por servicios/drivers con UUID deterministas de harness, no con los rangos oficiales ni por HTTP completo; no se repitió sobre un entorno ya usado y no incluye UI/E2E.

## 6. Resultados experimentales

**Ejecutados QE-01..05 (semilla 42).** Tres casos base independientes de DEMO-150: 100/1 000/10 000 lotes con profundidades reales 3/8/15, diez componentes productivos y 20/40/40 distribuciones. En cada caso se verificó primero la equivalencia de UUID, niveles y destinos entre SQL y Cypher (hash idéntico en las cinco consultas) y después se aplicaron 5 calentamientos y 30 repeticiones medidas por motor y consulta, alternando el orden. Total: **900 mediciones y 150 calentamientos, 0 errores**. Entorno: Node 22.22.0, PostgreSQL 16.16, Neo4j 5.26.34, Linux x64, 12 CPU, 3.69 GB RAM, contenedores aislados.

| Caso / profundidad | Consulta | SQL mediana / p95 (ms) | Cypher mediana / p95 (ms) | Resultados |
|---|---|---:|---:|---:|
| 100 / 3 | QE-01 descendientes | 3.096 / 4.841 | 7.871 / 11.240 | 6 |
| 100 / 3 | QE-02 antecedentes | 3.153 / 4.551 | 7.970 / 11.182 | 8 |
| 100 / 3 | QE-03 comunes | 3.306 / 5.157 | 8.364 / 12.843 | 4 |
| 100 / 3 | QE-04 distancia | 3.136 / 5.079 | 8.043 / 11.115 | 1 |
| 100 / 3 | QE-05 impacto/destinos | 3.135 / 5.427 | 8.004 / 12.460 | 2 |
| 1 000 / 8 | QE-01 descendientes | 4.487 / 7.439 | 8.548 / 12.096 | 36 |
| 1 000 / 8 | QE-02 antecedentes | 4.660 / 7.132 | 9.182 / 15.267 | 44 |
| 1 000 / 8 | QE-03 comunes | 3.544 / 4.897 | 8.194 / 10.781 | 3 |
| 1 000 / 8 | QE-04 distancia | 4.094 / 5.382 | 8.518 / 12.063 | 1 |
| 1 000 / 8 | QE-05 impacto/destinos | 4.465 / 5.389 | 8.149 / 10.862 | 1 |
| 10 000 / 15 | QE-01 descendientes | 172.699 / 525.581 | 147.235 / 258.307 | 127 |
| 10 000 / 15 | QE-02 antecedentes | 141.033 / 187.250 | 134.439 / 169.671 | 135 |
| 10 000 / 15 | QE-03 comunes | 3.664 / 177.284 | 7.939 / 12.316 | 3 |
| 10 000 / 15 | QE-04 distancia | 150.127 / 581.719 | 42.219 / 69.766 | 1 |
| 10 000 / 15 | QE-05 impacto/destinos | 170.385 / 229.552 | 121.724 / 182.687 | 1 |

SQL fue más rápido en los casos pequeños; a 10 000 lotes y profundidad 15, Cypher fue más rápido en QE-01, QE-03, QE-04 y QE-05, y similar en QE-02. La alta desviación de QE-01/QE-04 en SQL a 10 000 lotes se conserva en los datos crudos; no se descartaron repeticiones. **No se afirma superioridad general**: la comparación es válida solo para esta topología, volumen, profundidad y entorno. Los 279 nodos/540 aristas de DEMO-150 son un conteo observado distinto, no parte de este benchmark. Datos crudos y resumen: `tests/benchmark/results/` y `docs/pruebas/benchmark-actual.{json,csv}`. **Casos adicionales DA-08 ejecutados:** mismo protocolo en nueve perfiles en total (tres casos base, dos de profundidad a 1 000 lotes con 3 y 15 niveles, y cuatro topologías a 1 000 lotes/profundidad 8: lineal, ramificada, convergente e independiente). Total acumulado: **2 700 mediciones, 450 calentamientos, 45/45 comparaciones de equivalencia correctas y 60 errores registrados**. Los 60 errores son QE-03 en SQL en los dos perfiles de profundidad 15: las 30 repeticiones de cada uno superaron el límite de 10 s (`statement_timeout`); no se descartaron ni se promediaron como éxitos. La equivalencia de conjuntos se verificó antes de medir en esos mismos perfiles. A 1 000 lotes, la mediana de QE-01 en SQL pasó de 3.589 ms (profundidad 3) a 5.971 ms (8) y 169.958 ms (15); en Cypher, de 8.091 a 11.058 y 139.332 ms. En el barrido de topologías a profundidad 8, la topología independiente fue la más rápida en todos los motores (mediana SQL 2.7–3.0 ms) y la ramificada produjo 99 descendientes en QE-01. **Diagnósticos ejecutados por separado:** `tests/benchmark/explain.mjs` corrió `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` y Cypher `PROFILE` sobre el caso 1 000 lotes/profundidad 8, y guardó los planes reales en `docs/pruebas/benchmark-plans.json`; los tiempos de esos planes no se mezclaron con las 2 700 mediciones de latencia. **No ejecutado:** medición API extremo a extremo.

## 7. Interpretación de los resultados
La evidencia soporta únicamente que, en esta topología proyectada, el recorrido dirigido devuelve los alias esperados y excluye la rama LP-005. Los destinos son relaciones de distribución, no transformaciones que propaguen a otros lotes. No se deduce causalidad sanitaria ni superioridad de rendimiento de Neo4j.

## 8. Limitaciones
El escenario canónico funcional se ejecutó por servicios reales y Outbox, con transición EN_ANALISIS, bloqueo manual temporal, impacto integrado y trazabilidad completa por servicio; no existe todavía un **seed final** con UUID fijos ni validación canónica por API. La concurrencia básica y la recuperación del Outbox ya se probaron con motores reales, pero faltan dos incidencias activas sobre un mismo lote, caída real de contenedores y reinicios. Las rutas HTTP de inicio/cierre, bloqueo/liberación, impacto y las cinco modalidades de trazabilidad se probaron en el escenario reducido. CI del merge `11ca103` terminó en `failure` en el build global por falta de `app/`/`pages/` en Next.js, expresamente pospuesto. No se desactivó el build; tampoco se ha comprobado CI de la rama actual.

## 9. Conclusiones sustentadas
El handler y las consultas Neo4j superaron la proyección aislada; una prueba reducida verificó rutas HTTP/Outbox, impacto y trazabilidad; el escenario canónico verificó topología, stock, calidad, expediente, impacto y cinco recorridos; DEMO-150 verificó la topología ampliada y DA-01..07 por servicios. El benchmark comparó cinco consultas equivalentes en nueve perfiles reales (volumen, profundidad y topología) y mostró ventajas de cada motor según consulta y escala, con timeouts de QE-03 en SQL registrados a profundidad 15. La validación canónica por API, UI/E2E y la aceptación completa siguen **pendientes**. No presentar estos resultados como aceptación final de TraceChain.

## 10. Evidencias y archivos relacionados
- `docs/pruebas/graph-projection-actual.json`: conteos y conjuntos **observados**, con limitaciones expresas.
- `docs/pruebas/graph-projection-actual.csv`: tabla derivada de esos mismos conteos (no tiempos de rendimiento).
- `tests/integration/canonical-graph.integration.mts`: generador, consultas, aserciones y limpieza de UUID propios.
- `tests/integration/graph-projection.integration.mts`: replay, distribución, rollback, convergencia y caminos.
- `tests/integration/graph-verification.integration.mts`: verificación conservadora de descendencia con Outbox SQL real.
- `tests/integration/operations-http.integration.mjs`: ruta HTTP reducida, separada del fixture canónico.
- `tests/integration/canonical-operations.integration.mjs` y `docs/pruebas/canonical-multimodel-actual.json`: escenario canónico funcional por servicios, evidencia observada y limitaciones.
- `backend/src/database/neo4j/traversal.mts`: Cypher ejecutado y algoritmo de recorrido.
- `backend/src/modules/traceability/`: cinco modalidades por API con enriquecimiento SQL y advertencias de parcialidad.
- `tests/integration/concurrency-sql.integration.mjs`, `tests/integration/outbox-recovery.integration.mjs` y `docs/pruebas/concurrency-recovery-actual.json`: carreras y recuperación observadas.
- `tests/integration/demo150-seed.integration.mjs` y `docs/pruebas/demo150-actual.json`: semilla ampliada y DA-01..07 por servicios, sin benchmark.
- `tests/benchmark/{run.mjs,summarize.mjs,explain.mjs,lib/}` y `docs/pruebas/benchmark-actual.{json,csv}` / `benchmark-plans.json`: generador, consultas equivalentes, 2 700 mediciones y planes EXPLAIN/PROFILE separados.
- `backend/src/database/neo4j/subgraph.mts`: selección visual acotada de tramos productivos reales (no interfaz gráfica).
- `docs/pruebas/README-grafo.md`: reproducción y alcance.
- `DATA_MODEL.md` §4/5, `REQUIREMENTS.md` PG-01..22: resultados esperados de referencia, **no mediciones**.

### Redacción académica propuesta (provisional)
- **Resumen:** «Se evaluó preliminarmente una proyección dirigida de trazabilidad sobre Neo4j con datos ficticios controlados. La validación multimodelo y la evaluación de rendimiento permanecen en curso».
- **Metodología:** «Se construyó la topología de nueve lotes mediante eventos de proyección y se consultaron dependencias `Lote→Proceso→Lote`, deduplicando lotes y acotando profundidad/caminos».
- **Resultados:** «En la proyección aislada se observaron 31 nodos y 35 relaciones; MP-001 alcanzó cuatro lotes derivados en dos niveles. LP-003 y LP-004 compartieron MP-001 y MP-002 como antecedentes; LP-005 quedó fuera».
- **Conclusiones:** «Los resultados prueban la semántica del recorrido en el conjunto controlado, no una ventaja de desempeño frente a PostgreSQL ni una integración completa con inventario y calidad».
