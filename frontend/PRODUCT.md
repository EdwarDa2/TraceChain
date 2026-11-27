# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Analista de calidad**: usuario principal en el flujo prioritario. Investiga no conformidades, abre y gestiona incidencias, consulta impacto y trazabilidad, aplica y retira bloqueos manuales.
- **Operador**: registra recepciones, órdenes de producción y distribuciones, y mantiene catálogos. Consulta las mismas lecturas; no ejecuta acciones de análisis restringidas al analista.

Decisión derivada de la instrucción del usuario y de `PROJECT.md` §1.1: se prioriza el flujo analítico sin eliminar las operaciones necesarias para alimentarlo.

## Product Purpose

TraceChain es una aplicación académica multimodelo para registrar operaciones de una panificadora ficticia y analizar la propagación **potencial** de problemas de calidad en una red de lotes con transformaciones sucesivas, ramificaciones y convergencias. El éxito es que un analista pueda pasar de inspecciones no conformes a antecedentes comunes, impacto integrado y decisiones de bloqueo justificadas sin confundir dependencia con contaminación o causalidad.

## Positioning

La genealogía se deriva de dependencias productivas dirigidas (PostgreSQL como autoridad operativa y Neo4j como proyección especializada), mientras que la calidad y los expedientes viven en MongoDB. El análisis distingue resultado vacío válido, parcial y no disponible, y nunca convierte un fallo de fuente en un cero.

## Operating Context

- Operaciones: recepción → producción multinivel → distribución completada entre ubicaciones.
- Calidad: lote → plantilla activa → inspección variable → incidencia opcional → investigación → impacto → bloqueo manual justificado → resolución.
- Idioma de interfaz: español. Fechas efectivas y caducidad según `DATA_MODEL.md`; cantidades como strings con tres decimales.
- El navegador solo usa HTTP JSON contra `/api/v1`; las credenciales y secretos nunca se exponen al cliente.

## Capabilities and Constraints

- 14 vistas definidas en `PROJECT.md` §3: login, dashboard, catálogos, inventario, detalle de lote, producción, distribución, inspecciones, incidencias, detalle de incidencia, impacto y trazabilidad.
- Roles OPERADOR y ANALISTA_CALIDAD con autorización efectiva en backend.
- Endpoints reales verificados en `API_CONTRACT.md` y en las pruebas de integración; la UI no debe inventar rutas ni datos.
- Grafo interactivo con alternativa textual; estados de carga, vacío, error y parcial.
- El token de sesión permanece en memoria; recargar exige iniciar sesión.
- Sin frontend de producción hasta F4; este producto cubre esa fase.

## Brand Commitments

Nombre: TraceChain. Paleta moderna Restrained propuesta e implementada en `src/app/globals.css`: canvas `#F6F8FB`, superficie `#FFFFFF`, tinta `#0B1220`, primario `#2563EB`, éxito `#15803D`, aviso `#B45309`, error `#DC2626`. El violeta `#7C3AED` se reserva para codificación semántica del grafo, no para decoración. Identidad institucional no certificada.

## Evidence on Hand

- Backend integrado y con CI verde en `develop` hasta PR #20.
- Pruebas reales: 55/55 unitarias, 6/6 integración, 9 perfiles de benchmark, EXPLAIN/PROFILE y latencia API.
- Datos ficticios de prueba; no hay datos reales de producción ni testimonios.

## Product Principles

1. La dependencia potencial no demuestra contaminación, causa ni aptitud sanitaria.
2. La fuente caída o pendiente nunca se representa como resultado completo.
3. La operación crítica no es optimista: el estado oficial viene del backend.
4. La interfaz sirve al flujo de investigación antes que a la administración.
5. Cada acción significativa es auditable mediante trazas, IDs y outbox.

## Accessibility & Inclusion

Objetivo WCAG 2.2 AA: contraste AA, foco visible, navegación por teclado, etiquetas y alternativa textual al grafo. No se afirma certificación sin auditoría manual.
