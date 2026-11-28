# Auditoría visual previa al rediseño

Fecha: 2026-11-27. Capturas reales del dev server (`localhost:3000`) con sesión de analista. Se revisaron las 14 rutas oficiales; no se encontraron errores de consola propios de la app. Los avisos de extensiones del navegador (`bis_skin_checked`, `M_ID`) se excluyen.

## Hallazgos

| Área | Observado | Problema |
|---|---|---|
| Sidebar | Lista plana de 10 enlaces, sin iconos ni agrupación | No comunica dominios ni jerarquía; difícil escaneo |
| Identidad | Sin logotipo propio, tipografía y peso planos | No se distingue como plataforma de análisis especializada |
| Dashboard | Cuatro tarjetas grandes, paneles separados y mucho espacio vacío | Baja densidad; no parece centro de control operativo |
| Tablas | Cabezeras simples, filas muy espaciadas, sin paginación visible | No aptas para análisis operativo denso |
| Formularios | Bloques grandes dentro de tarjetas, etiquetas y controles amplios | Espacio desperdiciado; el formulario domina la vista |
| Estados | “Cargando datos reales…” y “Sin resultados” en recuadros punteados | Estado poco profesional y sin jerarquía |
| Inspecciones / incidencias | Mezclan formulario y listado sin separación de espacio de trabajo | El investigador no tiene un área de análisis clara |
| Trazabilidad | Formulario y resultados textuales; el grafo no tiene protagonista | La función más importante parece un reporte administrativo |
| Impacto | Métricas y tablas, sin visualización central del alcance | No se aprecia la propagación potential |

## Dirección derivada

Plataforma Operate de alta densidad: navegación agrupada con iconos Lucide, superficie monocromática, acento azul solo para acción/selección, semántica para estado, tablas compactas, panel lateral de contexto en calidad y un espacio de trabajo de grafo con Cytoscape en trazabilidad e impacto.

Referencias conceptuales usadas como criterio, no copiadas: Linear (jerarquía), Vercel (geometría), Palantir Foundry (densidad operativa), Neo4j Bloom (exploración de grafo).
