# Hallazgos y mejoras propuestas — evaluación de comprensión

**Fecha:** 2026-11-28. **Autor:** profesor evaluador. **Complemento de:** [`evaluacion-docente.md`](./evaluacion-docente.md).

Las mejoras son **del sistema** (interfaz, semilla de demostración, documentación de uso y verificación), no ampliaciones del MVP. Ninguna propuesta crea RF nuevos, endpoints nuevos, colecciones, tablas ni etiquetas de grafo: todas reutilizan contratos ya definidos en `API_CONTRACT.md` y se apoyan en los datos y reglas existentes. Su objetivo es que un evaluador pueda **entender qué hace TraceChain y por qué**, sin leer antes cien páginas de especificación.

## 1. Hallazgos

| ID | Severidad | Dónde | Evidencia observada | Impacto en la comprensión |
|---|---|---|---|---|
| **H-01** | Alta (funcional) | `Ver impacto` en `/incidents/:id` | Clic en dos incidencias distintas → `404 This page could not be found`. `docker logs` confirma `GET .../impact 404`. El mismo URL responde 200 en el build del árbol principal. | La promesa central del sistema (impacto potencial integrado) queda inalcanzable desde la ficha de incidencia en la demo en ejecución. |
| **H-02** | Alta (flujo) | `/inspections` | Solo hay filtro «No conformes», una etiqueta decorativa «Plataforma de investigación» y una tabla sin filas seleccionables (0 *checkboxes*, 0 enlaces a detalle). Para llegar a `Comunes` hay que copiar UUID a mano en `/traceability`. | El flujo prioritario QI-04 / DA-03 (seleccionar 2–5 lotes no conformes → antecedentes comunes) no existe como experiencia guiada. Es la pregunta científica del proyecto. |
| **H-03** | Media | `/inspections`, `/incidents/:id`, impacto, `/traceability` | Columna «Lote» con UUID como `f854ecc2-7c16-…`; formulario de bloqueo pide «Lotes (UUID separados por coma)»; el selector de productos repite seis veces «Materia prima auditoría» sin código. | El usuario no puede reconocer el objeto sobre el que decide; aumenta el riesgo de bloquear el lote equivocado y hace opaca la relación entre módulos. |
| **H-04** | Media | Semilla de demostración | Catálogos con «Producto ficticio 1..15», «Proveedor ficticio 1..8», «Sucursal ficticia 1..4», «Proceso 1..3», mientras `DATA_MODEL.md` §5 describe Harina, Azúcar, Masa, Pan y Galletas. | La panificadora —contexto que hace legible el sistema— desaparece de la pantalla. Solo se distingue por unidad (`KG`/`UNIDAD`). |
| **H-05** | Media | Panel «Estado del sistema» del dashboard | Muestra «Sincronización: AVAILABLE» junto a «Eventos pendientes: 4» y «MONGODB: PENDING». El panel está al final de la página. | Un estado degradado se lee como normal. No se explica qué implica para la confianza del impacto (RF-35 / RN-124). |
| **H-06** | Media | `/inspections` | No se muestran los endpoints `/quality/summary` ni `/quality/findings`, aunque existen; las filas no abren el detalle (`GET /inspections/:id`). | RF-19 queda invisible: no se percibe el perfil de calidad ni se puede revisar un hallazgo o una evidencia. |
| **H-07** | Baja | Varias vistas | Etiquetas crudas: `FORWARD`, `COMPLETO`, `EN ANALISIS`, `SINCRONIZADO`, `DISTRIBUCION_ENTRADA`, `MATERIA_PRIMA · KG`. | El vocabulario técnico desplaza al lenguaje del negocio; un estudiante puede confundir estado de análisis con estado sanitario. |
| **H-08** | Media | `README.md` | Tres líneas; no hay requisitos, arranque, credenciales de demo ni ruta guiada, aunque `PRODUCT.md` y `DESIGN.md` sí existen. | Un evaluador externo no puede reproducir lo que se le pide evaluar; contradice RNF-19 y el objetivo de defensa académica. |
| **H-09** | Media | Formularios de incidencia y bloqueo | «Lote origen» y «Lotes (UUID separados por coma)» obligan a escribir/pegar identificadores; las opciones duplicadas del H-03 dificultan la selección. | La entradas son propensas a error y no enseñan la relación incidencia → lote → descendientes. |
| **H-10** | Media (verificación) | Proceso de puesta en marcha | `/incidents/:id/impact` no fue registrado por el servidor en ejecución pese a existir en el árbol principal; no hay smoke que recorra la ruta crítica de principio a fin. | La demostración puede fallar justo en el momento de la defensa, y el fallo no se distingue de un defecto de código. |

> Nota de contexto: `docs/pruebas/ui-audit-before.md` ya señalaba problemas visuales (sidebar plano, baja densidad, grafo sin protagonismo). El rediseño actual **los corrigió**: menú agrupado con iconos, tablas compactas, `GraphViewer` y panel de lectura textual. Los hallazgos de ahora son de **semántica y recorrido**, no de maquetación.

## 2. Mejoras propuestas (priorizadas)

### P0 — H-01: asegurar la ruta de impacto

1. Reiniciar el servidor de demostración desde el árbol/revisión que se vaya a presentar y volver a hacer clic en `Ver impacto` desde una incidencia `EN_ANALISIS`.
2. Añadir un **smoke de ruta crítica** (E2E ligero) que, con la semilla de demo, ejecute: login → incidencia → impacto → trazabilidad → detalle de lote, y falle explícitamente si cualquier URL devuelve 404.
3. En el componente `Ver impacto`, usar `Link` de Next.js en lugar de anclas que provoquen recarga completa; así se conserva la sesión en memoria y se evita la pérdida de estado.
4. **Criterio de aceptación:** los cinco E2E de `REQUIREMENTS.md` más este smoke terminan con 200 en las rutas del recorrido; la evidencia queda con fecha, rama y commit.

### P0 — H-02: convertir inspecciones en el punto de entrada del análisis

1. Sustituir la etiqueta decorativa «Plataforma de investigación» por un **panel de trabajo** con una acción real: «Seleccionar lotes no conformes para análisis».
2. Permitir marcar de 2 a 5 filas del listado filtrado por `NO_CONFORME` (casillas + «Seleccionar todo»), respetando RN-127 (se cuentan inspecciones, no lotes contaminados) y deduplicando por lote.
3. El botón «Analizar antecedentes comunes» navega a `/traceability` con la modalidad `Comunes` preseleccionada y los `lotIds` precargados; reutiliza `POST /traceability/common-origins`, **sin endpoint nuevo**. Mostrar la advertencia «Origen común es una hipótesis, no una causa».
4. **Criterio de aceptación:** con la semilla DEMO-150, seleccionar `b2`/`c2` de una inspección no conforme lleva a `r1, r2, r3` como antecedentes comunes y muestra la alternativa textual (DA-03).

### P1 — H-03 y H-09: identificadores comprensibles y selección asistida

1. Crear un componente compartido `LotLabel` que muestre `CODIGO · nombre producto` y, debajo en texto pequeño/monoespacio, el UUID. Alimentarlo de `GET /lots?limit=100` (ya usado en la página) con caché de TanStack Query; nunca consultar el grafo para esto.
2. Reemplazar el campo «Lotes (UUID separados por coma)» por un **multiselect buscable** de lotes del impacto verificado; el valor enviado sigue siendo `UUID[]`, sin cambios de contrato.
3. En los selectores de producto, mostrar `código · nombre · tipo/unidad` y deduplicar por `code`, para que «Materia prima auditoría» deje de repetirse seis veces sin distinción.
4. **Criterio de aceptación:** en cualquier pantalla donde aparezca un lote, el usuario ve su código y producto sin copiar UUID entre pestañas.

### P1 — H-04: semilla de demostración con dominio reconocible

1. Para la demo (no para el benchmark ni para el fixture de regresión), cargar el escenario canónico de `DATA_MODEL.md` §5 o el DEMO-150 con nombres de catálogo del dominio: Harina A/B, Azúcar, Mantequilla, Masa, Mezcla, Pan, Galletas; proveedores y sucursales con nombres descriptivos.
2. Mantener los UUID deterministas y las cantidades oficiales; cambiar solo campos descriptivos permitidos por el contrato. Documentar en la semilla que es un conjunto de demostración, separado del generador DAG.
3. **Criterio de aceptación:** un evaluador que no haya leído el DATA_MODEL pueda responder «¿qué se transforma en qué?» mirando solo Inventario, Producción y Trazabilidad.

### P1 — H-05: estado del sistema en lenguaje claro

1. Elevar el indicador de sincronización a la cabecera del dashboard; si hay eventos pendientes o un motor caído, mostrar distintivo **DEGRADED** y una frase: «4 eventos pendientes: el análisis de impactos puede estar desactualizado».
2. Publicar un **glosario contextual** (icono `?` en la cabecera) con `COMPLETO`, `PARCIAL`, `NO_DISPONIBLE`, `PENDIENTE`, `SINCRONIZADO`, `AVAILABLE`/`DEGRADED`. El contrato y los enum no cambian; solo se traducen para la persona.
3. **Criterio de aceptación:** con eventos pendientes, la UI no muestra `AVAILABLE` como único estado visible y explica la consecuencia para el análisis.

### P1 — H-06: resumen de calidad y detalle de inspección

1. Añadir al panel de inspecciones una franja compacta con `/quality/summary` (total, % no conforme y por producto) y `/quality/findings` (hallazgos por tipo/severidad), reutilizando `Recharts` que ya está en el stack.
2. Hacer clicable cada fila para abrir un panel lateral con `GET /inspections/:id`: parámetros con etiqueta y unidad, hallazgos, evidencias y versión de plantilla.
3. **Criterio de aceptación:** desde el listado se puede ver un hallazgo y su evidencia sin salir de la vista; el porcentaje sin inspecciones se muestra como `null`/«sin datos», nunca 0 inventado (RN-127).

### P2 — H-07: lenguaje de negocio en las etiquetas

1. Traducir a español natural las etiquetas visibles (`Hacia adelante`, `En análisis`, `Sincronizado`, `Salida por distribución`), conservando el código oficial en `title`/tooltip y en los datos devueltos por la API.
2. Normalizar `EN ANALISIS` → «En análisis», `NO_CONFORME` → «No conforme» en badges, sin alterar los valores enviados al backend.
3. Añadir una línea permanente en el pie de las vistas de análisis: «Impacto potencial: una dependencia productiva no demuestra contaminación». Ya existe en el panel de impacto; extenderla a trazabilidad e incidencia refuerza el principio RN-81.

### P2 — H-08: README como guía de evaluación

1. Documentar: requisitos (Node 22, Docker Compose v2), `npm ci`, `docker compose up -d`, migraciones/semilla, credenciales ficticias **vía entorno** (sin valores reales en Git) y cómo limpiar el entorno de pruebas.
2. Incluir un **recorrido de cinco minutos**: login → dashboard → inventario → inspecciones → incidencia → impacto → trazabilidad → bloqueo justificado, con qué se espera ver en cada paso.
3. Explicar la diferencia entre los tres conjuntos de datos (canónico, DEMO-150, benchmark) y remitir a `RESULTADOS_POSTER.md` para la evidencia experimental.

### P2 — H-10: verificación continua de la comprensión

1. Incorporar al CI el smoke de la P0 y una comprobación de que las 14 rutas devuelven 200 con sesión válida.
2. Registrar en `PROGRESS.md` los resultados **reales** de ese smoke con fecha, rama y commit; mantener `TESTING` hasta que exista evidencia de integración.
3. Repetir la auditoría Lighthouse y una prueba de teclado en las vistas de grafo; no afirmar certificación WCAG sin revisión humana.

## 3. Orden sugerido de ejecución

1. **P0:** H-01 (demo arrancable) y H-02 (flujo de investigación) — son los que hacen que la defensa funcione.
2. **P1:** H-03/H-09 (nombres legibles), H-04 (dominio panadero), H-05 (estados claros), H-06 (calidad visible).
3. **P2:** H-07 (lenguaje), H-08 (README), H-10 (verificación).

**Principio rector de las mejoras:** no añadir funcionalidad nueva; hacer que la funcionalidad ya construida se pueda **encontrar, entender y explicar**. Cada mejora debe conservar los contratos v1 (`/api/v1`, `payloadVersion` 1, enum oficiales en español) y las reglas de negocio RN-81/RN-97..108.
