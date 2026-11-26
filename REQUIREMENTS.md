# Requerimientos de TraceChain — v1.1

Consolidación de los 75 RF y 51 RNF iniciales en 35 RF y 20 RNF; los detalles se conservan como criterios y reglas en BUSINESS_RULES.md. IDs de esta versión sustituyen a los de la propuesta inicial. P0 núcleo; P1 necesario para completar MVP; P2 extensión no obligatoria (no incluida en los 35). No equivalen a 55 pantallas.

| ID | Prioridad | Requerimiento funcional / criterio de aceptación |
|---|---|---|
| RF-01 | P1 | Iniciar y cerrar sesión con cuentas precargadas; rechazar credenciales inválidas e cerrar sesión local y rechazar token expirado o cuenta inactiva. |
| RF-02 | P1 | Aplicar roles OPERADOR y ANALISTA_CALIDAD en backend y navegación; denegar acciones no autorizadas. |
| RF-03 | P1 | Dashboard básico con conteos, actividad reciente y accesos permitidos; sin gráficas avanzadas en dashboard; calidad tiene resumen propio. |
| RF-04 | P0 | Gestionar proveedores (crear, listar, editar datos descriptivos, desactivar); preservar historial. |
| RF-05 | P0 | Gestionar productos con tipo y unidad fija; listar, editar y desactivar sin romper historial. |
| RF-06 | P0 | Gestionar ubicaciones; impedir desactivación con stock positivo. |
| RF-07 | P0 | Registrar recepción de materia prima; crear lote único, existencia, movimiento y evento SQL atómicamente. |
| RF-08 | P0 | Consultar inventario por lote, producto y ubicación; diferenciar stock físico y utilizable. |
| RF-09 | P1 | Consultar detalle integrado de lote, movimientos, proveedor/origen, calidad y procedencia. |
| RF-10 | P1 | Buscar y filtrar catálogos, lotes y operaciones; paginar listados. |
| RF-11 | P0 | Registrar producción completada con una o más entradas y salidas; actualizar inventario y generar nuevos lotes en una transacción. |
| RF-12 | P0 | Admitir transformaciones multinivel; un lote fabricado puede ser insumo de otra producción. |
| RF-13 | P1 | Consultar listado y detalle de producciones con consumos, resultados y movimientos. |
| RF-14 | P0 | Registrar distribución completada de uno o más lotes entre ubicaciones; conservar ID y transferir stock atómicamente. |
| RF-15 | P1 | Consultar historial de distribuciones con origen, destino, cantidades y fecha. |
| RF-16 | P0 | Cargar plantilla preconfigurada específica por producto o general; generar campos y validar contra la versión. |
| RF-17 | P0 | Registrar inspecciones variables con resultado, parámetros, observaciones, hallazgos y referencias de evidencias. |
| RF-18 | P0 | Consultar historial y detalle de inspecciones de lote; permitir filtros por producto y resultado. |
| RF-19 | P1 | Obtener agregaciones básicas de calidad por producto/resultado y tipo de hallazgo (incluye resumen y gráfica simple de no conformidad y hallazgos). |
| RF-20 | P0 | Crear incidencia con lote origen, clasificación, severidad y expediente, con o sin inspección previa, expediente versionado. |
| RF-21 | P0 | Consultar incidencias y su expediente; indicar estado de persistencia documental. |
| RF-22 | P1 | Asociar inspecciones y referencias de evidencia al expediente, preservando referencias válidas. |
| RF-23 | P0 | Gestionar estados ABIERTA → EN_ANALISIS → CERRADA; registrar resolución y no reabrir. |
| RF-24 | P0 | Trazabilidad hacia adelante: descendientes únicos, nivel directo/indirecto y destinos. |
| RF-25 | P0 | Trazabilidad hacia atrás: antecedentes, procesos y proveedores de origen. |
| RF-26 | P0 | Orígenes comunes: intersección de antecedentes de dos a cinco lotes distintos; solo analista. |
| RF-27 | P0 | Caminos: encontrar rutas dirigidas entre dos lotes, con procesos y límites. |
| RF-28 | P0 | Visualizar grafos interactivos, selección de nodos, zoom/desplazamiento y detalle; alternativa textual. |
| RF-29 | P0 | Calcular impacto potencial desde el lote de origen; deduplicar y clasificar por profundidad mínima. |
| RF-30 | P0 | Reporte integrado: cantidades por lote/unidad/ubicación, destinos históricos, calidad y relaciones; mostrar faltantes. |
| RF-31 | P1 | Aplicar bloqueos manuales por lote e incidencia con justificación; impedir nuevas producciones/distribuciones. |
| RF-32 | P1 | Retirar restricciones individualmente con motivo; mantener bloqueo mientras exista otra restricción activa. |
| RF-33 | P0 | Proyectar operaciones SQL a Neo4j mediante outbox persistente con reintentos idempotentes. |
| RF-34 | P0 | Crear/actualizar expediente en MongoDB mediante mecanismo recuperable cuando SQL origina el cambio; verificar referencias compartidas. |
| RF-35 | P0 | Exponer estado de sincronización y disponibilidad; distinguir resultado vacío válido, parcial y no disponible. |

**Prioridad analítica v1.1:** RF-24..30 constituyen el núcleo de investigación; RF-16..23 y RF-33..35 aportan evidencia documental y consistencia. Los 35 RF y 20 RNF conservan IDs, alcance y contratos; se refuerza aceptación con casos DA-01..08, sin pantallas o servicios nuevos.

## Requerimientos no funcionales
Los umbrales son objetivos de aceptación en entorno documentado; no afirmar cumplimiento hasta probar.

| ID | Categoría | Criterio verificable |
|---|---|---|
| RNF-01 | Rendimiento | Objetivo p95 ≤ 2 s para consultas convencionales en entorno y carga documentados. |
| RNF-02 | Rendimiento | Objetivo p95 ≤ 5 s en análisis definidos para 10 000 lotes, documentando profundidad y límites; no prometer todos los caminos ilimitados. |
| RNF-03 | Escalabilidad | Evaluar 100, 1 000 y 10 000 lotes con datos reproducibles; consultas/indexación/paginación adecuados. |
| RNF-04 | Autenticación | Hash Argon2id y sesiones/tokens con expiración; comprobar acceso inválido/expirado. |
| RNF-05 | Autorización | Verificar permisos en todas las rutas protegidas; probar 401/403 según caso. |
| RNF-06 | Seguridad de datos | Validación de entradas, consultas parametrizadas y filtros permitidos; pruebas de entradas inválidas. |
| RNF-07 | Secretos y transporte | Secretos fuera de Git/cliente/logs; HTTPS fuera de local; .env.example sin valores sensibles. |
| RNF-08 | Integridad relacional | PK, FK, unicidad y restricciones; rechazar stock negativo, duplicados y referencias inválidas. |
| RNF-09 | Atomicidad y concurrencia | Operaciones de inventario y outbox atómicas; pruebas de rollback, consumo simultáneo y carrera con bloqueos. |
| RNF-10 | Integridad documental | Validadores Mongo y verificación contra plantilla/versiones y referencias del dominio. |
| RNF-11 | Integridad del grafo | Identidades únicas, genealogía acíclica, relaciones idempotentes; verificar equivalencia con SQL. |
| RNF-12 | Consistencia eventual | Proyección converge al procesar eventos; reintentos sin duplicados; prueba de caída y recuperación. |
| RNF-13 | Fiabilidad | Distinguir fuente caída, pendiente o consulta truncada; no mostrar falso resultado completo. |
| RNF-14 | Persistencia | Reinicio de servicios no pierde datos confirmados ni eventos; registrar errores sin secretos. |
| RNF-15 | Usabilidad | UI en español, navegación y estados claros; comprobar flujo completo por ambos roles. |
| RNF-16 | Accesibilidad | Objetivo WCAG 2.2 AA: contraste, teclado, foco, etiquetas, grafo con alternativa textual; validar, no afirmar certificación. |
| RNF-17 | Compatibilidad | Interfaz usable en escritorio/tableta y navegadores modernos Chrome, Edge, Firefox; verificar casos. |
| RNF-18 | Mantenibilidad | Módulos separados, TypeScript, convenciones, documentación API y pruebas; revisión de PR. |
| RNF-19 | Reproducibilidad | Docker Compose, variables, migraciones y seeds; comprobar arranque limpio y pruebas desde README. |
| RNF-20 | Evaluación | Pruebas unitarias/integración/E2E, benchmark SQL/Cypher equivalente, evidencia real reproducible. |

## Matriz de trazabilidad y pruebas obligatorias
P0 y P1 son ambos obligatorios; prioridad es orden de implementación. Los identificadores CP se conservan como casos transversales; los catálogos TP/PM/PG/PI/PS/E2E refinan sus escenarios. Resultados esperados, no pruebas ejecutadas.

| RF | Responsable | Vistas | Pruebas mínimas |
|---|---|---|---|
| RF-01 | I-1 | 01 | PS-01..03, PS-10..11, E2E-01 |
| RF-02 | I-1 | 01..14 | PS-04..08 |
| RF-03 | I-1/3 | 02 | TP-20, E2E-01 |
| RF-04 | I-1 | 03 | TP-01..02 |
| RF-05 | I-1 | 04 | TP-02, TP-21 |
| RF-06 | I-1 | 05 | TP-14 |
| RF-07 | I-1 | 06 | TP-03..05, PI-01 |
| RF-08 | I-1 | 06/07 | TP-19..20 |
| RF-09 | I-1/2/3 | 07 | PI-09..10 |
| RF-10 | I-1/2 | 03..12 | PS-08, TP-22 |
| RF-11 | I-1 | 08 | TP-06..11 |
| RF-12 | I-1/3 | 08/14 | PG-05..07 |
| RF-13 | I-1 | 08 | TP-19..20 |
| RF-14 | I-1 | 09 | TP-12..13, PI-03 |
| RF-15 | I-1 | 09 | TP-20 |
| RF-16 | I-2 | 10 | PM-01..02, PM-11 |
| RF-17 | I-2 | 10 | PM-03..10 |
| RF-18 | I-2 | 07/10 | PM-03..04, PI-04 |
| RF-19 | I-2 | 10 | PM-17..18 |
| RF-20 | I-2/1 | 11 | PM-12..15, PI-05 |
| RF-21 | I-2 | 12 | PM-13..14, PI-10 |
| RF-22 | I-2 | 12 | PM-16, PM-21 |
| RF-23 | I-2/1 | 12 | PM-19..20, PM-22 |
| RF-24 | I-3 | 14 | PG-05..06, PG-11 |
| RF-25 | I-3 | 14 | PG-07 |
| RF-26 | I-3 | 14 | PG-08, PS-07, E2E-03 |
| RF-27 | I-3 | 14 | PG-09..10, PG-13 |
| RF-28 | I-3 | 13/14 | PG-19, E2E-03 |
| RF-29 | I-3 | 13 | PG-06, PG-12, PI-07 |
| RF-30 | I-3/1/2 | 13 | PI-07, PI-10 |
| RF-31 | I-2/1/3 | 12/13 | TP-08, TP-17, PI-08 |
| RF-32 | I-2/1 | 12 | TP-17, E2E-04 |
| RF-33 | I-1/3 | todas | PG-01..04, PG-15..17 |
| RF-34 | I-1/2 | 12 | PM-12..16 |
| RF-35 | I-1/2/3 | 02/07/12/13/14 | PI-10, E2E-05 |

## Catálogos de pruebas
Entorno aislado PostgreSQL tracechain_test, MongoDB tracechain_quality_test, Neo4j Community contenedor independiente (DB neo4j). Fixtures ficticios, reloj inyectable. Jest/Vitest unitarias, Jest contra DB real, Supertest API, Playwright E2E. Pruebas con mocks no sustituyen integración real. Ver fixture en DATA_MODEL y protocolo de benchmark en PROJECT.

| ID | Escenario y resultado esperado |
|---|---|
| TP-01 | Alta proveedor válida |
| TP-02 | Código duplicado → 409, sin escritura |
| TP-03 | Recepción: lote, stock, movimiento, outbox |
| TP-04 | Proveedor inactivo → rechazo |
| TP-05 | Cantidad negativa → 422 |
| TP-06 | Producción multiinsumo: cantidades correctas |
| TP-07 | Consumo superior al stock → 409, intacto |
| TP-08 | Bloqueado → 409 |
| TP-09 | Caducado → 409 |
| TP-10 | Producción multisalida: todas dependencias |
| TP-11 | Fallo inyectado en cada paso incluido outbox → rollback |
| TP-12 | Distribución: dos movimientos, mismo lote, stock total igual |
| TP-13 | Origen igual a destino → rechazo |
| TP-14 | Desactivar ubicación con stock → 409 |
| TP-15 | Idempotencia: misma clave mismo cuerpo, una operación; distinto cuerpo 409 |
| TP-16 | Consumos simultáneos 70/50 de 100: solo uno, no negativo |
| TP-17 | Dos bloqueos, liberar uno: sigue bloqueado; liberar último habilita si vigente |
| TP-18 | Mutación histórica no permitida |
| TP-19 | Historial saldo anterior/posterior coherente |
| TP-20 | Fixture oficial: inventario exacto |
| TP-21 | Tipo/unidad históricos inmutables |
| TP-22 | Paginación/filtros/orden y desempate UUID |
| TP-23 | Carrera bloqueo-consumo: orden serializable por lock de lote |
| TP-24 | Reinicio conserva datos y eventos |
| TP-25 | Fechas retroactivas/futuras y escala inválidas rechazadas |
| PM-01 | Plantilla específica harina |
| PM-02 | General si no hay específica |
| PM-03 | Inspección harina válida |
| PM-04 | Inspección pan heterogénea válida |
| PM-05 | Falta parámetro requerido → 422 |
| PM-06 | Clave dinámica desconocida → 422 |
| PM-07 | BSON incorrecto rechazado por validador |
| PM-08 | Lote inexistente → 404 |
| PM-09 | No conforme sin hallazgo → 422 |
| PM-10 | Repetir inspección misma clave → un documento; distinto hash 409 |
| PM-11 | Recuperar versión histórica |
| PM-12 | Expediente único |
| PM-13 | Mongo caído: incidencia sin referencias confirmada, expediente pendiente |
| PM-14 | Recuperar conexión → expediente único sincronizado |
| PM-15 | Reprocesar evento → sin duplicar versión |
| PM-16 | Versión incorrecta → 409 |
| PM-17 | Agregación por resultado: fixture 3/1 |
| PM-18 | Agregación hallazgos por tipo/severidad correcta |
| PM-19 | Cerrar con expediente pendiente → 409 |
| PM-20 | Editar expediente cerrado → 409 |
| PM-21 | Referencias duplicadas/inexistentes/no pertinentes rechazadas; fuente caída no se trata como ausencia |
| PM-22 | Cierre desde EN_ANALISIS con resolución y expediente listo; no libera bloqueos |
| PM-23 | Plantilla inactiva para nueva inspección rechazada |
| PG-01 | Recepción proyecta nodo y relaciones |
| PG-02 | Producción multiinsumo proyectada |
| PG-03 | Multisalida proyectada |
| PG-04 | Replay sin duplicados |
| PG-05 | MP-001 directos LP-001/002 |
| PG-06 | MP-001 descendientes LP-001/002/003/004 |
| PG-07 | LP-003 antecedentes LP-001, MP-001/002/003 |
| PG-08 | Comunes LP-003/004: MP-001/002 |
| PG-09 | Ruta MP-001 a LP-003: dos transformaciones |
| PG-10 | MP-001 a LP-005 sin ruta |
| PG-11 | Destinos MP-001: Centro/Norte |
| PG-12 | Impacto MP-004: LP-005 y Sur |
| PG-13 | Convergencia: deduplicación y mínimo nivel |
| PG-14 | Proveedor/producto/destino compartido no propaga |
| PG-15 | Neo caído: SQL conserva operaciones |
| PG-16 | Recuperación de eventos en orden |
| PG-17 | Fallo dentro de evento → rollback Neo |
| PG-18 | Profundidad corta con frontera adicional → PARCIAL |
| PG-19 | Truncamiento solo visual no convierte análisis completo en parcial |
| PG-20 | Equivalencia SQL/Cypher de UUID y niveles |
| PG-21 | Exactamente límite vs límite+1; caminos y nodos |
| PG-22 | Co-insumo no es descendiente; raíz excluida salvo impacto |
| PI-01 | Recepción UUID compartido |
| PI-02 | Producción SQL/Neo consistente |
| PI-03 | Distribuciones y cantidades equivalentes |
| PI-04 | Inspección referencia lote SQL |
| PI-05 | Incidencia/expediente asociados |
| PI-06 | No conformes → antecedentes comunes correctos |
| PI-07 | Impacto integrado fixture exacto |
| PI-08 | Bloqueo descendiente comprobado; origen sin Neo; ausencia inconclusa no autoriza |
| PI-09 | Detalle lote tres motores |
| PI-10 | Fuente caída/pendiente/consulta parcial explícita |
| PI-11 | Caída tras commit destino antes de ACK SQL: replay seguro |
| PI-12 | Worker interrumpido: recuperar PROCESANDO; no salto de evento |
| PI-13 | Cambio durante lectura: advertir parcial si detectado |
| PI-14 | Carrera cierre/actualización: una transición válida; ningún expediente cerrado editable |
| PS-01 | Sin token → 401 |
| PS-02 | Expirado → 401 |
| PS-03 | Token alterado → 401 |
| PS-04 | Operador registra inspección → 403 |
| PS-05 | Analista registra producción → 403 |
| PS-06 | Operador bloquea → 403 |
| PS-07 | Operador consulta comunes → 403 |
| PS-08 | Propiedad desconocida → 400 |
| PS-09 | Entradas de texto no ejecutan instrucciones de DB |
| PS-10 | Cuenta inactiva con token → 401 |
| PS-11 | Exceso de intentos login → 429 |
| PS-12 | Respuestas/logs sin secretos |

### E2E
| ID | Flujo |
|---|---|
| E2E-01 | Operador inicia sesión, catálogos, recepción, inventario, producción, distribución, genealogía, sale. |
| E2E-02 | Analista inspecciona, registra no conformidad/incidencia, inicia análisis, consulta impacto, bloquea, actualiza expediente, cierra. |
| E2E-03 | Seleccionar LP-003 y LP-004 no conformes, consultar comunes, verificar MP-001/002 y alternativa textual. |
| E2E-04 | Operador intenta usar lote bloqueado, rechazo visible; retirar bloqueo individual no cambia físico. |
| E2E-05 | Motor secundario caído: UI distingue sección no disponible, luego recuperación. |

### Aceptación analítica ampliada (DEMO-150)
Pruebas adicionales DA-01..08 de los RF/RNF existentes, no nuevos RF ni endpoints. Ejecutar sobre el escenario separado DATA_MODEL §5.1 con motores reales sincronizados. Mantener TP/PM/PG/PI/PS/E2E originales y sus fixtures. Comparar con manifiesto/oráculo independiente; almacenar parámetros, respuestas sanitizadas, conjuntos de UUID y evidencia. Las pruebas de mutación/fallo se hacen sobre copia/entorno dedicado y no alteran el dataset de referencia de forma permanente.

| ID | RF/RNF y pruebas base reforzadas | Criterio verificable |
|---|---|---|
| DA-01 | RF-07/11/12/14/33/34; PG-02/03, PI-01..05 | Seed reproducible con 150 lotes, 60 órdenes, 40 distribuciones, 80 inspecciones, 10 incidencias/expedientes, 279 nodos y 540 aristas por tipo según §5.1. Stock válido; UUID, eventos y proyecciones coherentes. No duplicados al repetir carga según protocolo. |
| DA-02 | RF-24/25/29; PG-06/07/13/22 | D01-r1: 12 descendientes únicos, niveles 2/4/4/2 lotes en 1/2/3/4; impacto 13 con raíz. Ancestros de b2/c2 exactos; excluir r2/r3 como descendientes. Convergencias no multiplican resultados. |
| DA-03 | RF-16..19/26; PM-17/18, PI-06, E2E-03 | 40/80 no conformes y 40 hallazgos APARIENCIA/MEDIA; seleccionar D01-b2/c2 no conformes en V-10, llegar a V-14, obtener exactamente r1,r2,r3 como antecedentes comunes, mostrando detalle y alternativa textual. Sin inferir causalidad ni crear incidencia automáticamente. |
| DA-04 | RF-27/28; PG-09/10/13/21 | Dos rutas r1→d1 de 3 transformaciones; r1→f1 camino mínimo 4, existe ruta de 5. Con límite de caminos se indica truncamiento si corresponde. D01-r1→D02-f1 sin camino; producto, proveedor o sucursal compartidos no bastan. |
| DA-05 | RF-29/30; PI-07/09, PG-11 | Impacto integrado de incidencia D01: exactamente 13 lotes y cuatro destinos B,C,D,E. f1 stock 28/8/4, total 40 unidades; f2 30/10 y e2 37/3. No sumar kg con unidades ni confundir 16 unidades transferidas de f1 con stock externo (12). Recuperar hallazgos y expediente, no duplicar cantidades por caminos. |
| DA-06 | RF-20..23/31/32; PI-08, E2E-02/04 | Analista documenta investigación con inspecciones pertinentes, versión correcta, justificación y bloqueo manual de descendiente verificado; operador no puede consumir/distribuirlo. Cierre no libera; retiro individual conserva stock físico. Nunca bloquear automáticamente; no bloquear independiente basándose en esta incidencia. |
| DA-07 | RF-28/35; PG-18/19, PI-10, E2E-05 | Profundidad 1 para r1: 2 descendientes, advertencia PARCIAL por frontera; mostrar diferencia entre vacío válido (sin ruta), parcial y no disponible. Con Mongo/Neo caídos o proyección pendiente, UI y API respetan estados del contrato; recuperar y repetir sin duplicados. |
| DA-08 | RNF-03/20; PG-20 | Evidencia de comparación SQL/Cypher QE-01..05: conjunto y profundidad equivalentes antes de medir; 3 tamaños base y pruebas adicionales a volumen fijo por profundidad/topología según PROJECT §8.1. Registrar nodos/aristas, selectividad, consultas, tiempos y errores reales; no usar DEMO-150 para sustituir benchmark. |

Para DA-03 no es necesario nuevo endpoint de correlación: los filtros/listados de inspecciones, el detalle, QI-04 y las agregaciones existentes bastan. DA-08 verifica evidencia de benchmark, no garantiza que Neo4j sea más rápido. La aceptación final exige los ocho casos y la revisión de resultados reales, además de los criterios originales.

### RNF y aceptación
RNF-01/02: medir P95 2s/5s en entorno de referencia, límite duro análisis 10s; RNF-03/20: QE-01..05 y protocolo PROJECT; RNF-04..07: PS-01..12 y revisión secretos/HTTPS; RNF-08/09: TP-03..18, TP-23/25; RNF-10: PM-01..23; RNF-11: PG-01..22; RNF-12/13/14: PI-10..14, TP-24, caída y recuperación; RNF-15/16/17: E2E y revisión manual teclado, foco, etiquetas, contraste, alternativa grafo, escritorio/tableta Chrome/Edge/Firefox; RNF-18/19: lint, typecheck, build, PR, arranque limpio Docker y README. No afirmar certificación WCAG por automatización sola.

Cobertura objetivo servicios críticos backend ≥85% líneas y ≥80% ramas; todos los escenarios críticos obligatorios, todos los endpoints con éxito/error/autorización aplicables y cinco E2E; frontend pruebas de comportamiento. Cobertura no reemplaza exactitud. Aceptación final: 14 vistas con API real; RF P0/P1; permisos; integridad SQL, documental y grafo; UUID coherentes, recuperación outbox, reporte integrado; pruebas críticas, instalación reproducible, sin errores críticos ni secretos; evaluación reproducible y documentación consistente; tres aprobaciones. Si objetivos de latencia/cobertura no se alcanzan, reportar, corregir o acordar excepción explícita (sin ocultar datos). No liberar con pérdida/duplicación de datos o resultados incorrectos presentados como completos.
