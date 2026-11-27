# Resultados provisionales para el póster — TraceChain v1.1

> **Alcance de esta evidencia (2026-11-26):** proyección y consultas Neo4j de una topología controlada inspirada en el escenario canónico. **No** es validación del escenario canónico multimodelo ni benchmark PostgreSQL vs. Neo4j. Datos enteramente ficticios; no implican contaminación confirmada.

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
| Proveedores de antecedentes de LP-003 | PROV-001/002/003 | PROV-001/002/003 |
| Procesos internos del alcance MP-001 | OP-000001..000004 | OP-000001..000004 |

Distribución por relación observada: `SUMINISTRA=4`, `CORRESPONDE_A=9`, `UTILIZADO_EN=8`, `GENERA=5`, `INCLUIDO_EN=3`, `SALE_DE=3`, `ENTREGADO_A=3`. En la prueba adicional de convergencia: **2 rutas dirigidas distintas** de longitud 2 hacia un mismo lote; `maxPaths=1` devolvió PARCIAL/PATH_LIMIT; la lista de alcance incluyó el lote convergente una sola vez.

En una **prueba separada** PostgreSQL+Neo4j con esquema SQL propio y dos lotes ficticios independientes, `verifyDescendant` devolvió `YES` para el camino positivo pese a un evento Neo pendiente, `UNKNOWN` para ausencia con cola pendiente y `NO` para el lote independiente tras completar la cola. La implementación compara la secuencia Outbox antes y después; no se probó aún una inserción concurrente controlada durante la lectura. No representa una incidencia o bloqueo creado por la API.

**No verificado en este escenario:** cuatro inspecciones, tres no conformes, incidencia, stock y existencias SQL, referencias UUID entre los tres motores ni una respuesta API integrada. Los conteos de calidad del documento de diseño no se reproducen aquí.

## 6. Resultados experimentales
**Sin resultados todavía.** No se generaron ni midieron conjuntos de 100, 1 000 y 10 000 lotes; QE-01..05 no se ejecutaron ni se comparó equivalencia SQL/Cypher. DEMO-150 y sus 279 nodos/540 aristas son valores **previstos**, no observados.

## 7. Interpretación de los resultados
La evidencia soporta únicamente que, en esta topología proyectada, el recorrido dirigido devuelve los alias esperados y excluye la rama LP-005. Los destinos son relaciones de distribución, no transformaciones que propaguen a otros lotes. No se deduce causalidad sanitaria ni superioridad de rendimiento de Neo4j.

## 8. Limitaciones
La aplicación aún no registra el escenario completo desde endpoints: `operations.mts` no persiste todas las filas operativas, no hay controladores de esas operaciones registrados en NestJS y faltan los módulos de trazabilidad/impacto API. Tampoco hay seed funcional completo ni validación de stock/calidad en esta ejecución. CI del merge `11ca103` terminó en `failure` en el paso de build global, coherente con la falta de `app/`/`pages/` en Next.js, expresamente pospuesto. No se desactivó el build.

## 9. Conclusiones sustentadas
El handler y las consultas Neo4j superaron la prueba aislada de topología productiva y replay. La consistencia multimodelo, el impacto integrado y la comparación experimental siguen **pendientes**. No presentar este resultado como aceptación final de TraceChain.

## 10. Evidencias y archivos relacionados
- `docs/pruebas/graph-projection-actual.json`: conteos y conjuntos **observados**, con limitaciones expresas.
- `docs/pruebas/graph-projection-actual.csv`: tabla derivada de esos mismos conteos (no tiempos de rendimiento).
- `tests/integration/canonical-graph.integration.mts`: generador, consultas, aserciones y limpieza de UUID propios.
- `tests/integration/graph-projection.integration.mts`: replay, distribución, rollback, convergencia y caminos.
- `tests/integration/graph-verification.integration.mts`: verificación conservadora de descendencia con Outbox SQL real.
- `backend/src/database/neo4j/traversal.mts`: Cypher ejecutado y algoritmo de recorrido.
- `docs/pruebas/README-grafo.md`: reproducción y alcance.
- `DATA_MODEL.md` §4/5, `REQUIREMENTS.md` PG-01..22: resultados esperados de referencia, **no mediciones**.

### Redacción académica propuesta (provisional)
- **Resumen:** «Se evaluó preliminarmente una proyección dirigida de trazabilidad sobre Neo4j con datos ficticios controlados. La validación multimodelo y la evaluación de rendimiento permanecen en curso».
- **Metodología:** «Se construyó la topología de nueve lotes mediante eventos de proyección y se consultaron dependencias `Lote→Proceso→Lote`, deduplicando lotes y acotando profundidad/caminos».
- **Resultados:** «En la proyección aislada se observaron 31 nodos y 35 relaciones; MP-001 alcanzó cuatro lotes derivados en dos niveles. LP-003 y LP-004 compartieron MP-001 y MP-002 como antecedentes; LP-005 quedó fuera».
- **Conclusiones:** «Los resultados prueban la semántica del recorrido en el conjunto controlado, no una ventaja de desempeño frente a PostgreSQL ni una integración completa con inventario y calidad».
