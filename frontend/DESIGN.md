# Design — TraceChain platform

## Mode

Operate. Una plataforma de análisis, no un sitio de marketing. La densidad, la jerarquía y la consistencia importan más que la expresión. La interfaz debe desaparecer frente a la investigación.

## Dirección

Sistema monocromático con un solo acento de acción (`#2563EB`) y semántica reservada para estados. La geometría es rectangular, con radios pequeños y separadores finos; sin gradientes decorativos ni sombras de tarjeta. La navegación agrupa dominios; el contenido usa paneles con cabecera y tablas densas.

Referencias conceptuales: Linear (jerarquía y compactación), Vercel (minimalismo geométrico), Palantir Foundry (densidad operativa), Neo4j Bloom (exploración de grafo). No se copian sus componentes.

## Tokens

| Rol | Valor |
|---|---|
| Canvas | `#F7F8FA` |
| Superficie | `#FFFFFF` |
| Superficie 2 / 3 | `#F1F3F6` / `#E9EDF2` |
| Tinta | `#101828` |
| Tinta 2 / 3 | `#475467` / `#667085` |
| Línea | `#E4E7EC` |
| Línea fuerte | `#D0D5DD` |
| Primario | `#2563EB` |
| Éxito / aviso / error | `#15803D` / `#B45309` / `#DC2626` |
| Radio | 4px controles, 6px paneles, 8px contenedores |
| Espaciado | escala 4/8/12/16/24/32 |
| Movimiento | 120–160ms, `cubic-bezier(0.23,1,0.32,1)` |

El violeta del contrato (`#7C3AED`) se conserva únicamente como dato del grafo en el póster; la UI usa azul para origen, gris para descendientes y verde para destinos.

## Tipografía

Una familia del sistema, escala fija en rem: 14px base, 1rem para `h2`, 1.5rem para `h1`. Numeración tabular en cantidades y fechas. Sin tipografía display ni `clamp()`.

## Componentes

- `Panel`: cabecera + cuerpo, sin tarjeta decorativa.
- `DataTable`: cabecera sticky, filas compactas, truncado con `title`, paginación.
- `StatusBadge` / `SyncStatus`: códigos oficiales en español, con punto semántico.
- `Field`, `SearchInput`, filtros y botones: un solo vocabulario visual.
- Estados: skeleton para carga, texto específico para vacío y error con acción de recuperación.
- `GraphViewer`: Cytoscape embebido, controles de zoom/fit, leyenda y panel lateral de detalle.

## Layout

Sidebar de 236px con cuatro grupos (GENERAL, OPERACIONES, CALIDAD Y ANÁLISIS, CATÁLOGOS), iconos Lucide, estado activo y menú de usuario inferior. El contenido usa breadcrumb, cabecera compacta y rejilla de trabajo `workspace`/`workspace-side`. A 900px la sidebar pasa a franja superior y el grafo a una columna.

## Trazabilidad e impacto

El grafo ocupa el espacio protagonista. El origen se distingue por tamaño y color; los procesos por forma rectangular y tono neutro; los destinos por rombo verde. El panel lateral muestra detalle del nodo, alcance potential y advertencias de parcialidad. La alternativa textual son las tablas de lotes/caminos.

## Verificación

`typecheck`, `lint` y `build` del workspace frontend pasan; `next build` genera 14 rutas. El detector de Impeccable devolvió `[]` tras corregir el borde lateral del banner de incidencia. Auditoría visual documentada en `docs/pruebas/ui-audit-before.md`. Quedan pendientes screenshot exhaustivos por breakpoint, Lighthouse/E2E y auditoría manual WCAG.
