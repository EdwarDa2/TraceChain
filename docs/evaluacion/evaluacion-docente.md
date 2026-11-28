# Evaluación docente de la propuesta TraceChain v1.1

**Rol:** profesor evaluador de la propuesta de software.
**Fecha:** 2026-11-28.
**Artefacto evaluado:** `TraceChain_Documentacion_IA_v1.1.zip` (siete documentos base: AGENTS, PROJECT, REQUIREMENTS, BUSINESS_RULES, DATA_MODEL, API_CONTRACT, PROGRESS) más el repositorio y la aplicación en ejecución.
**Naturaleza:** evaluación formativa. No modifica código, contratos, migraciones ni el punto de control (`PROGRESS.md`). Los hallazgos y las mejoras se detallan en [`hallazgos-y-mejoras.md`](./hallazgos-y-mejoras.md).

> **Advertencia de alcance (AI-15/AI-18):** el propio `PROJECT.md` declara que la línea base v1.1 es planificación, «no representa software construido ni pruebas ejecutadas». Por tanto, esta evaluación compara **lo prometido** con **lo que hoy se puede navegar**, sin presentar la documentación como evidencia de ejecución ni la ejecución como sustituto de la documentación.

## 1. Metodología seguida

1. Lectura íntegra de los siete documentos base y de `README.md`, `RESULTADOS_POSTER.md`, `PRODUCT.md`, `DESIGN.md` y `docs/pruebas/ui-audit-before.md`.
2. Extracción y cotejo del ZIP adjunto: contiene exactamente los siete documentos base; no aporta código ni evidencia nueva.
3. Inspección real de Git: rama de trabajo `redesign/frontend-platform` con 15 archivos modificados y 3 sin seguimiento; historial con commits de frontend, API y benchmark.
4. Navegación real en navegador (`http://localhost:3000`) con la cuenta de analista de la semilla local ficticia; recorrido de las 14 vistas, ejecución de una consulta de trazabilidad y del enlace de impacto.
5. Comprobaciones HTTP directas sobre el build del árbol principal (`http://localhost:3002`) para distinguir defecto de código de problema del servidor en ejecución.
6. Auditoría automatizada de accesibilidad/buenas prácticas con Lighthouse sobre el dashboard.
7. Contraste de lo observado con RF-01..35, RNF-01..20, V-01..14 y los casos DA-01..08.

**No ejecuté en esta sesión** `npm ci`, `lint`, `typecheck`, `test`, `build`, migraciones ni benchmark. Las cifras de pruebas que se citan proceden de `PROGRESS.md` y `RESULTADOS_POSTER.md` y se identifican como **evidencia declarada por el equipo**, no como verificación propia.

### Sobre el entorno observado

El servidor que responde en `:3000` fue iniciado en un **worktree distinto** (rama `redesign/clinical-blueprint-v2`), no en el directorio evaluado (rama `redesign/frontend-platform`). Se nombran ambas ramas para evitar ambigüedad: lo navegado es una variante de rediseño hermana, no el árbol con cambios sin confirmar. El build del árbol principal sí incluye la ruta de impacto (HTTP 200); el servidor en ejecución no la registró (HTTP 404). Esta diferencia se trata en H-01.

## 2. Dictamen ejecutivo

| Dimensión | Valoración |
|---|---|
| Coherencia de la propuesta documental | ** Alta.** 35 RF, 20 RNF, 14 vistas, contratos y reglas de negocio trazables entre sí; cautela académica explícita (dependencia ≠ contaminación). |
| Correspondencia propuesta ↔ software navegado | **Media-alta.** 13 de 14 vistas accesibles y funcionales con API real; el enlace crítico a impacto falla en la instancia en ejecución. |
| Comprensión de la interfaz | **Media.** La navegación y la densidad mejoraron frente a la auditoría previa, pero el flujo analítico prioritario no está guiado y varios identificadores se muestran crudos. |
| Reproducibilidad para un evaluador externo | **Baja.** `README.md` tiene tres líneas; no hay guía de arranque ni de demo. |
| Evidencia experimental | **Documentada pero no verificada por este evaluador.** El equipo reporta 2 700 mediciones y 45/45 equivalencias; aquí solo se coteja su consistencia narrativa. |

**Conclusión:** la propuesta es ambiciosa, bien acotada y defensable desde el punto de vista académico. El software ya demuestra la mayor parte de la estructura prometida, pero **un profesor o estudiante que llegue sin contexto no logra seguir de principio a fin la pregunta central de investigación** (de inspecciones no conformes a impacto y decisión de bloqueo). Las mejoras deben ir dirigidas a cerrar esa brecha de comprensión, no a ampliar el MVP.

## 3. Matriz propuesta ↔ observado

| Elemento prometido | Observado en la navegación | Resultado |
|---|---|---|
| V-01 `/login` | Formulario con correo/contraseña, error legible, sesión en memoria (recargar obliga a entrar de nuevo). | Cumple |
| V-02 `/dashboard` | Cuatro KPI (40 lotes, 25 órdenes, 6 incidencias, 0 bloqueados), actividad por tipo, actividad reciente, accesos rápidos y estado del sistema. | Cumple |
| V-03/04/05 catálogos | Proveedores (18), productos (27) y ubicaciones (17) con filtros activos/inactivos y paginación. | Cumple |
| V-06 `/inventory` | 40 lotes con físico/utilizable/estado/grafo; búsqueda global por código funciona y filtra la tabla. | Cumple |
| V-07 `/inventory/:id` | Movimientos con saldo anterior/posterior, saldos por ubicación, incidencias y bloqueos del lote. | Cumple |
| V-08 `/production` | 25 órdenes con entradas, salidas y estado de grafo. | Cumple |
| V-09 `/distribution` | 11 transferencias con origen, destino, ítems y fecha. | Cumple |
| V-10 `/inspections` | Listado filtrable y formulario dinámico por plantilla activa. Sin detalle de inspección ni puente a análisis. | Parcial (H-02, H-03, H-06) |
| V-11 `/incidents` | 6 incidencias con severidad, estado y expediente; filtros de flujo; formulario de apertura. | Cumple |
| V-12 `/incidents/:id` | Estado oficial y documental, expediente versión 1, cierre y bloqueo manual con justificación. | Cumple |
| V-13 `/incidents/:id/impact` | Ruta presente en código y en el build principal (200); **404 en el servidor navegado**. | No verificable en demo (H-01) |
| V-14 `/traceability` | Cinco modalidades; consulta `Adelante` ejecutada: `COMPLETO`, 280 ms, 3 descendientes en niveles 1/2/3, leyenda y alternativa textual. | Cumple |
| RF-02 roles | El formulario de inspección solo aparece para `ANALISTA_CALIDAD`; backend reporta 403 en pruebas declaradas. | Cumple en UI; permisos no reejecutados aquí |
| RF-28 grafo | `GraphViewer` con canvas, selección de nodo ypanel de detalle;auditoría Lighthouse 1.0 en dashboard. | Cumple |
| RF-35 estados | KPI de sincronización, eventos pendientes (4), fallidos (0), Mongo `PENDING` y Neo `SYNCHRONIZED`. | Parcial: semántica poco explicada (H-05) |
| RNF-19 reproducibilidad | `README.md`: solo `# TraceChain` y `#1 Creacion de la rama develop`. | No cumple (H-09) |
| DA-01..08 / QE-01..05 | Evidencia extensa en `docs/pruebas/` y `RESULTADOS_POSTER.md`; estados `TESTING`, no `VERIFIED`/`MERGED` en `PROGRESS.md`. | Declarado, no verificado aquí |

## 4. ¿Qué se comprende con facilidad?

- El propósito global se anuncia en el login («Plataforma de trazabilidad e impacto potencial») y se confirma en el dashboard.
- La navegación está agrupada en General / Operaciones / Calidad y análisis / Catálogos, con iconos y estado activo visible: se entiende dónde están las operaciones y dónde el análisis.
- La secuencia operativa (recepción → producción → distribución) es inferible de los nombres de menú y de las tablas.
- El detalle de lote responde con claridad a «¿cuánto hay, dónde está y qué movimientos lo explican?».
- La trazabilidad muestra de forma explícita el resultado (`COMPLETO`), el nivel de cada lote y una lectura textual del grafo.
- La ficha de incidencia distingue estado oficial (`EN ANALISIS`) de estado documental (`SINCRONIZADO`) y ofrece acciones claras (ver impacto, cerrar, bloquear).

## 5. ¿Qué cuesta comprender?

- No existe un recorrido guiado que explique **por qué** se inspecciona, **qué** se busca con los antecedentes comunes y **cómo** se decide un bloqueo. La cadena está en la documentación, no en la interfaz.
- El término «Plataforma de investigación» es una etiqueta decorativa: no abre ninguna herramienta de investigación.
- Los lotes se identifican con UUID en inspecciones, impactos y formularios de bloqueo; el usuario no puede reconocer «harina» o «pan» sin copiar y pegar códigos entre pantallas.
- Los datos de demostración se llaman «Producto ficticio 1», «Proveedor ficticio 2», «Proceso 3»: son válidos como fixtures, pero ocultan el dominio panadero que da sentido al proyecto.
- Los estados técnicos (`FORWARD`, `COMPLETO`, `PENDING`, `DISTRIBUCION_ENTRADA`) se muestran sin glosario ni traducción.
- El panel de estado del sistema aparece al final del dashboard y convive con un indicador «AVAILABLE» mientras hay eventos pendientes y Mongo en `PENDING`.
- No hay ayuda contextual, ni guía de primer uso, ni documentación de ejecución accesible desde la propia app.

## 6. Evidencia concreta recogida

| Prueba | Comando / acción | Resultado real |
|---|---|---|
| Navegación de 14 rutas | Browser sobre `:3000`, sesión de analista | 13 vistas con contenido real; `/incidents/:id/impact` → 404 |
| Consulta de trazabilidad | `Adelante`, lote `LOT-000001`, profundidad por defecto | `FORWARD / COMPLETO / 280 ms`; LOT-000003 (nivel 1), LOT-000004 (2), LOT-000005 (3) |
| Búsqueda global | Escribir `LOT-000001` en «Buscar lotes…» y Enter | Navega a `/inventory` y deja 1 registro |
| Impacto en build del árbol principal | `Invoke-WebRequest http://localhost:3002/incidents/<uuid>/impact` | HTTP 200, 9 778 bytes (la ruta existe en el código entregado) |
| Impacto en servidor en ejecución | Clic en «Ver impacto» desde dos incidencias distintas | HTTP 404 en ambas; `docker logs` registra `GET .../impact 404` |
| Accesibilidad | Lighthouse sobre `/dashboard` | Accessibility 1.0, Best Practices 1.0, SEO 1.0; sin fallos |
| Estado de Git | `git status --short --branch`, `git log --oneline -8` | `redesign/frontend-platform`, cambios sin confirmar; último commit `fb5b92b` |
| Consola del navegador | `browser.console(level=error)` en las vistas recorridas | Sin errores propios de la app; único 404 de ruta de impacto |

**Capturas:** se capturaron pantallas reales del login y del dashboard (2026-11-28) durante la navegación; el resto del recorrido se documenta con el texto accesible y las comprobaciones HTTP anteriores.

## 7. Limitaciones de esta evaluación

- No se probó el rol OPERADOR en navegador; la restricción de acciones se infiere del código y de la evidencia declarada, no de una ejecución propia.
- No se reprodujeron fallos de motor (Mongo/Neo caídos), concurrencia, idempotencia ni el escenario DEMO-150 completo.
- La instancia navegada pertenece a una rama distinta del directorio evaluado; cuando ambas difieran, se ha cotejado el resultado con el código y el build del árbol principal.
- Las calificaciones de esta sección son cualitativas y formativas; no constituyen aprobación académica ni aceptación de release.
