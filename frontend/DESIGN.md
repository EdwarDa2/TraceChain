# Design — TraceChain platform

## Mode

Operate. Plataforma de análisis, no sitio de marketing. La densidad, la jerarquía y la consistencia importan más que la expresión; la interfaz desaparece frente a la investigación.

## Dirección

“Clinical blueprint on frosted paper”: sistema casi acromático inspirado en shadcn/ui — canvas gris claro, papel blanco, tinta negra y una única superficie lateral ligeramente más cálida. El blanco y el gris construyen la jerarquía; el rojo `#E7000B` aparece solo en errores y acciones destructivas. No hay azul decorativo, verde de éxito ni ámbar de aviso: el estado se comunica con texto y forma, no con color.

Referencias: shadcn/ui (tokens explícitos y radios generosos), Vercel/Geist (neutralidad geométrica), Linear (densidad y jerarquía). No se copian componentes de terceros.

## Tokens

| Rol | Valor | Uso |
|---|---|---|
| Canvas | `#F5F5F5` | Fondo de página, relleno de inputs y botones secundarios |
| Surface Alt | `#FAFAFA` | Sidebar, filas alternas, superficies sutiles |
| Paper | `#FFFFFF` | Tarjetas, paneles y botón primario invertido |
| Ink | `#0A0A0A` | Texto principal, encabezados |
| Ink Soft | `#171717` | Botón primario, estado activo, barras |
| Mid Gray | `#6B6B6B` | Texto secundario, etiquetas, iconos en reposo (ligera corrección de accesibilidad sobre `#737373`, que da 4.34:1 sobre canvas) |
| Hairline | `#E5E5E5` | Bordes de tarjetas, tablas y badges |
| Ember | `#E7000B` | Solo error/destructivo |

- Radios: **24px** contenedores y tarjetas; **18px** botones, inputs y badges; **10px** anidados; **6px** elementos pequeños.
- Sombra de tarjeta: `0 0 0 1px rgb(23 23 23 / 5%), 0 1px 3px rgb(0 0 0 / 10%), 0 1px 2px -1px rgb(0 0 0 / 10%)`.
- Espaciado: 4/8/12/16/20/24/32/48/80 px. Ancho máximo de contenido: 1280px.
- Movimiento: 120–160 ms con `cubic-bezier(0.23, 1, 0.32, 1)`; `:active scale(0.98)`; `prefers-reduced-motion` respetado.

Excepción contractual: el violeta `#7C3AED` permanece **únicamente como codificación semántica del nodo de origen en el grafo** (D-003 / `PROJECT.md`), nunca como acento decorativo de la interfaz.

## Tipografía

Pila `'Geist', 'Inter', ui-sans-serif, system-ui…` sin descargar fuentes externas en el build. Cuerpo 14px/1.43; caption 12px/1.33 con tracking `0.6px`; encabezado 30px/1.2 con tracking `-0.75px`. Numeración tabular en cantidades y fechas. Sin `clamp()` ni tipografía display.

## Componentes

- `Panel` / tarjeta de métrica: papel, borde hairline, radio 24px, sombra apilada y padding 20px.
- Botones: píldora de 18px y 36–40px de alto. Primario tinta sobre papel; secundario gris sobre canvas; ambos comparten geometría y peso 500.
- Inputs: relleno canvas, sin borde en reposo, radio 18px; foco con anillo hairline y outline visible de teclado.
- Badges: píldora 18px, neutrales por defecto; solo el estado de error usa ember.
- `DataTable`: cabecera sticky en Surface Alt, filas compactas, truncado con `title` y paginación.
- Estados: skeleton, vacío con texto específico y error con ember; `warning-strip` en neutro para advertencias de parcialidad.
- `GraphViewer`: Cytoscape con origen violeta (dato), descendientes negros, procesos grises y destinos ink-soft; leyenda, zoom/fit y panel lateral con alternativa textual.

## Layout

Sidebar de 236px en Surface Alt, sin divisor lateral, con cuatro grupos (GENERAL, OPERACIONES, CALIDAD Y ANÁLISIS, CATÁLOGOS), iconos Lucide y estado activo invertido. Breadcrumb tipográfico, cabecera de página y rejilla `workspace` / `workspace-side`. El contenido se centra hasta 1280px. A 900px la sidebar pasa a franja desplazable y el grafo a una columna.

## Verificación

`typecheck`, `lint`, `build`, detector de Impeccable, Lighthouse y E2E contra API real; capturas en 1440/768/390. Los resultados reales se registran en `PROGRESS.md` y `docs/pruebas/`. No se declara certificación WCAG sin auditoría manual.
