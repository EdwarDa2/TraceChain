# Design — TraceChain UI

## Mode

Operate. La interfaz sirve a una tarea: investigar dependencias e impacto. La familiaridad y la consistencia ganan sobre la expresión. No hay hero de marketing ni secciones de página de producto.

## Paleta

Restrained, derivada de la propuesta aprobada por el usuario y de `PROJECT.md §3`.

| Token | Hex | Uso |
|---|---|---|
| `--canvas` | `#F6F8FB` | Fondo general |
| `--surface` | `#FFFFFF` | Paneles, tablas, formularios |
| `--surface-2` / `--surface-3` | `#EEF2F7` / `#E4EAF2` | Sidebar, toolbar, cabezera de tabla |
| `--ink` | `#0B1220` | Texto principal |
| `--ink-muted` | `#526071` | Etiquetas y texto secundario (AA sobre superficie) |
| `--border` / `--border-strong` | `#D8E0EA` / `#B9C5D4` | Separadores y controles |
| `--primary` | `#2563EB` | Acción principal, selección, foco |
| `--success` / `--warning` / `--danger` | `#15803D` / `#B45309` / `#DC2626` | Éxito, aviso, error |
| `--graph` | `#7C3AED` | Solo codificación semántica del grafo |

El violeta del grafo no se usa como acento decorativo. Se mantiene el primario `#2563EB` del contrato.

## Tipografía

Una sola familia del sistema a escala fija en rem: 15px base, `1.125rem` para `h1`, `1.375rem` para `h2`, `1.875rem` para `h1` de página. Numeración tabular en cantidades y fechas. Sin tipografía display.

## Componentes

- Un solo vocabulario: `.card`, `.button`, `.button-primary`, `.field`, `.badge`, `DataTable`, `SearchInput`.
- Todo control tiene estados por defecto, hover, foco `:focus-visible`, `:active` con `scale(0.98)`, deshabilitado, carga y error.
- `StatusBadge` y `SyncStatus` son la única fuente visual de estado; las etiquetas conservan los códigos oficiales en español.
- Tablas densas con cabecera en superficie secundaria y desplazamiento horizontal;no se inventan datos cuando la fuente falla.
- `LoadingState`, `EmptyState` y `ErrorState` son explícitos. Los resultados parciales muestran `warning` y `StatusBadge`.

## Layout

Shell de dos columnas: sidebar de navegación y contenido con `32px/40px` de padding. A `900px` la sidebar pasa a franja superior y las rejillas colapsan a una columna. Márgenes iguales a izquierda y derecha; sin desplazamiento lateral.

## Movimiento

Transiciones de 160ms con `cubic-bezier(0.23, 1, 0.32, 1)` en transform y color. Sin animación de entrada por página. `prefers-reduced-motion` detiene todo movimiento.

## Verificación

`npm run lint`, `typecheck` y `build` del workspace frontend pasan; `next build` genera 14 rutas. El detector mecánico de Impeccable devolvió `[]`. No se ha ejecutado aún una revisión visual completa en navegador ni auditoría WCAG manual.
