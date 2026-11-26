# BUSINESS_RULES.md — Reglas de negocio v1.0

Consolida RN-01 a RN-108 de la última etapa de análisis. Las reglas se aplican en backend y mediante restricciones físicas de DATA_MODEL.md. Los criterios de prueba son expectativas, no resultados. TraceChain es una herramienta académica de apoyo, no certifica calidad sanitaria.

## Generales
- RN-01: Identificadores internos únicos e inmutables.
- RN-02: Códigos visibles únicos por entidad (versiones de plantillas se distinguen por código + versión).
- RN-03: Operaciones de usuario autenticadas y autorizadas; acciones internas del worker identificadas como sistema.
- RN-04: No eliminar ni modificar operaciones históricas completadas.
- RN-05: Desactivar catálogos sin eliminar relaciones históricas.
- RN-06: Cantidades expresadas en la unidad fija del producto.

## Autenticación y permisos
- RN-07: Solo cuentas activas acceden.
- RN-08: Un rol por cuenta.
- RN-09: Operador registra recepción, producción y distribución y gestiona catálogos.
- RN-10: Analista registra inspecciones, gestiona incidencias y aplica/retira bloqueos.
- RN-11: Validar permisos en backend, no confiar en UI. Ambos consultan operaciones, inspecciones, incidencias, impacto, trazabilidad y caminos; orígenes comunes solo analista.

## Catálogos
- RN-12: Proveedor inactivo no admite nuevas recepciones.
- RN-13: Producto MATERIA_PRIMA, INTERMEDIO o TERMINADO.
- RN-14: Unidad definida para cada producto.
- RN-15: No modificar unidad ni tipo de un producto con lotes registrados.
- RN-16: Producto inactivo no puede originar nuevos lotes por recepción ni producción; consultar y gestionar existencias previas según demás reglas.
- RN-17: Ubicación con existencias positivas no puede desactivarse.
- RN-18: Producción y distribución en ubicaciones activas.

## Recepción e inventario
- RN-19: Recepción requiere proveedor, producto y ubicación existentes y activos.
- RN-20: Recepciones externas solo de materias primas en MVP.
- RN-21: Cantidad recibida positiva.
- RN-22: Código interno de lote único.
- RN-23: Caducidad, si existe, igual o posterior a fecha de origen (comparación de fecha civil).
- RN-24: Lote con único origen RECEPCION o PRODUCCION.
- RN-25: Existencias nunca negativas.
- RN-26: Una existencia por combinación lote/ubicación.
- RN-27: Cada cambio de existencia genera movimiento automático e inmutable.
- RN-28: Lote, existencia inicial, movimiento y evento outbox en misma transacción.

## Producción
- RN-29: Al menos un lote de entrada.
- RN-30: Al menos un lote nuevo de salida.
- RN-31: Stock utilizable suficiente de insumos en ubicación de producción.
- RN-32: No usar lotes bloqueados, caducados ni agotados.
- RN-33: Cantidades consumidas y producidas positivas.
- RN-34: Productos intermedios y terminados pueden ser insumos.
- RN-35: Lote fabricado generado por una única orden.
- RN-36: Salidas con IDs nuevos.
- RN-37: Genealogía productiva dirigida acíclica; lote no es su propio antecedente.
- RN-38: Todos los resultados de una orden dependen potencialmente de todos sus insumos; separar órdenes si no comparten ingredientes.
- RN-39: Fecha de producción no anterior al origen de sus insumos.
- RN-40: Orden, consumos, resultados, lotes, stock, movimientos y outbox en una transacción.
No exigir igualdad de cantidades de entradas/salidas, ni comparar unidades incompatibles; no calcular rendimiento industrial ni concentraciones de contaminantes.

## Distribución
- RN-41: Al menos un lote por distribución completada.
- RN-42: Origen distinto del destino.
- RN-43: Cantidad positiva y no superior al stock utilizable de origen.
- RN-44: No distribuir bloqueados, caducados ni agotados.
- RN-45: Conservar identificadores de lotes.
- RN-46: Descontar origen e incrementar destino.
- RN-47: Cada detalle genera movimiento de salida y entrada.
- RN-48: Todos los cambios y outbox en una transacción. No crea transformación ni lote; sin tránsito.

## Inspecciones
- RN-49: Inspección asociada a lote existente.
- RN-50: Lote admite múltiples inspecciones.
- RN-51: Plantilla activa específica; general activa solo si no hay específica.
- RN-52: Validar tipos y campos obligatorios de plantilla.
- RN-53: Conservar versión exacta usada.
- RN-54: Contenido de versiones inmutable; solo activo puede cambiar por migración.
- RN-55: Resultado CONFORME o NO_CONFORME.
- RN-56: NO_CONFORME requiere al menos un hallazgo.
- RN-57: Analista determina resultado, no el software.
- RN-58: No crear incidencia ni bloqueo automáticamente por no conformidad.

## Incidencias
- RN-59: Exactamente un lote origen por incidencia.
- RN-60: Puede crearse con o sin inspección previa.
- RN-61: Inspecciones asociadas existentes y relevantes para investigación.
- RN-62: Severidad BAJA, MEDIA o ALTA determinada por analista.
- RN-63: Expediente documental obligatorio como estado final; temporalmente pendiente/error si falla escritura.
- RN-64: Estados ABIERTA → EN_ANALISIS → CERRADA.
- RN-65: Cierre con resolución registrada y expediente persistido correctamente.
- RN-66: No reabrir incidencia cerrada en MVP; registrar otra si procede.
- RN-67: Cierre conserva inspecciones, relaciones y bloqueos históricos.
- RN-68: Calcular lotes potencialmente afectados dinámicamente; no lista estática autoritativa.

## Trazabilidad
- RN-69: Adelante por dependencias productivas dirigidas.
- RN-70: Atrás por dependencias productivas inversas.
- RN-71: Antecedentes comunes = intersección de antecedentes de todos los lotes seleccionados.
- RN-72: Caminos respetan dirección de transformación.
- RN-73: Deduplicar lotes aunque existan múltiples caminos; conservar rutas relevantes según límites.
- RN-74: Profundidad mínima en transformaciones (raíz 0, directa 1, indirecta ≥2); no aristas brutas.
- RN-75: Proveedor/producto/ubicación compartidos no implican dependencia.
- RN-76: Distribución identifica destinos, no propaga hacia otros lotes.
- RN-77: Límites de profundidad, tiempo o resultados que trunquen análisis requieren advertencia de parcialidad.

## Análisis de impacto
- RN-78: Comenzar desde lote origen oficial de incidencia.
- RN-79: Incluir descendientes directos e indirectos.
- RN-80: Destinos incluyen distribuciones de origen y descendientes.
- RN-81: Etiquetar impacto potencial, nunca contaminación confirmada o causalidad probada.
- RN-82: Analizar no modifica inventario ni bloquea automáticamente.
- RN-83: Cantidades oficiales desde PostgreSQL.
- RN-84: Inspecciones y evidencias desde MongoDB.
- RN-85: Agrupar por lote, producto, ubicación y unidad; no sumar unidades incompatibles.
- RN-86: Distinguir destinos históricos y existencias actuales. Ejemplo: 100 unidades en almacén, traslado de 40 a A y luego 15 de A a B: 60/25/15 actuales, 55 transferidas acumuladas, no 55 unidades distintas.

## Bloqueo y desbloqueo
- RN-87: Solo analista aplica/retira restricciones.
- RN-88: Bloqueo asociado a lote e incidencia.
- RN-89: Justificación y confirmación explícita.
- RN-90: Global para lote, todas ubicaciones.
- RN-91: Varias incidencias pueden bloquear mismo lote.
- RN-92: Máximo un bloqueo activo por lote/incidencia.
- RN-93: Retiro registra usuario, fecha y motivo.
- RN-94: Lote bloqueado mientras exista al menos una restricción activa.
- RN-95: No modificar existencias físicas por bloqueo.
- RN-96: Cerrar incidencia no retira bloqueos automáticamente; retiro individual y justificado.

## Integración
- RN-97: PostgreSQL fuente de verdad operativa y estado oficial de incidencia.
- RN-98: MongoDB fuente de verdad de inspecciones, plantillas y expedientes.
- RN-99: Neo4j proyección especializada de relaciones operativas.
- RN-100: UUID compartido por entidad representada en varios motores.
- RN-101: Eventos persistentes en misma transacción SQL que operación relevante.
- RN-102: Reprocesamiento idempotente sin duplicados.
- RN-103: Respetar orden y dependencias de eventos.
- RN-104: Registrar errores y conservar eventos recuperables.
- RN-105: Advertir análisis incompleto cuando eventos pendientes puedan afectarlo (MVP: criterio conservador global para grafo).
- RN-106: Falla Neo4j no revierte SQL ya confirmado.
- RN-107: Documentos de calidad referencian entidades existentes; validar en servicio.
- RN-108: Falla de conexión no equivale a ausencia de resultados.

## Restricciones técnicas transversales
PK/FK/UNIQUE/CHECK, transacciones, validación documental, índices de unicidad de nodos, identidad estable de relaciones y expediente único. Las cantidades utilizables son cero si lote bloqueado/caducado; de lo contrario, stock físico. Zona civil America/Mexico_City; caducado si fecha_caducidad es anterior al día civil actual (válido durante la fecha indicada). Control de concurrencia: producción, distribución y bloqueo deben coordinarse mediante locks de lote y stock, con revalidación dentro de transacción; no basta comprobar antes de escribir. Idempotencia HTTP separada de outbox. Si no se puede consultar autoridad, no aceptar operación crítica como exitosa. No exponer secretos.

## Casos de prueba mínimos
| ID | Escenario | Resultado esperado |
|---|---|---|
| CP-01 | Recepción 100 kg | Lote, stock, movimiento y evento creados |
| CP-02 | Código duplicado | Rechazo, sin escritura parcial |
| CP-03 | Consumo 120 de 100 | Rechazo, stock intacto |
| CP-04 | Insumo bloqueado | Rechazo |
| CP-05 | Producción con dos salidas | Dependencias de ambas a todos los insumos |
| CP-06 | Fallo en actualización de stock | Rollback de toda operación SQL |
| CP-07 | Trasladar 30 unidades | Saldos correctos, dos movimientos, mismo ID lote |
| CP-08 | Inspección sin campo requerido | Rechazo |
| CP-09 | Inspecciones de harina y pan | Estructuras variables válidas |
| CP-10 | Descendientes de MP-001 | Dos directos y dos indirectos según fixture |
| CP-11 | Antecedentes comunes | MP-001 y MP-002 para pan y galletas del fixture |
| CP-12 | Proveedor compartido sin insumo común | No propagar a rama independiente |
| CP-13 | Retirar uno de dos bloqueos | Lote permanece bloqueado |
| CP-14 | Cerrar sin resolución | Rechazo |
| CP-15 | Registrar producción con Neo4j caído | SQL confirmado y evento pendiente |
| CP-16 | Reprocesar evento repetido | Sin duplicados |
| CP-17 | Grafo desactualizado | Advertencia de parcialidad |
| CP-18 | Consumos concurrentes 70 y 50 sobre 100 | Uno se confirma; otro se rechaza; no negativo |
| CP-19 | Incidencia con MongoDB caído, sin inspección previa | SQL conserva registro, expediente pendiente |
| CP-20 | Recuperar MongoDB | Expediente persistido sin duplicados |

Pruebas adicionales recomendadas: caducidad, carrera bloqueo/consumo, destino compartido, co-insumo no afectado, múltiples rutas deduplicadas, reenvío HTTP, permisos, caída tras escritura destino antes de confirmar evento, cierre con expediente pendiente y recuperación de worker interrumpido.

## Reglas añadidas de consolidación (preservan RN-01..108)
- RN-109: Una empresa; ubicación activa cualquiera de los tres tipos puede participar en operaciones si cumple reglas (fixture usa planta principal).
- RN-110: Cantidades SQL NUMERIC(18,3), API string exacto tres decimales, UNIDAD exige parte decimal cero. Rechazar overflow y escala inválida, no redondear entradas.
- RN-111: Fecha efectiva de recepción, producción y distribución no futura; producción/distribución no anteriores al origen ni al movimiento efectivo más reciente de cada lote involucrado, globalmente; igualdad permitida. Validar dentro de locks. Inspección/detección no anterior a origen ni futura. Bloqueo, liberación, registro y cierre usan reloj servidor. Caducidad comparada con día civil de negocio al confirmar operación y al consultar, también exigir fecha efectiva no posterior a caducidad de insumos.
- RN-112: Códigos manuales de catálogos/lotes normalizados trim y mayúsculas, regex ^[A-Z0-9_-]{1,50}$; inmutables. OP/DIST/INC secuencias con mínimo seis dígitos; saltos permitidos. INS- + UUID completo; plantillas código+versión.
- RN-113: Producción 1..50 entradas distintas y 1..20 salidas de códigos distintos; distribución 1..50 lotes distintos; rechazar duplicados de payload, no agregarlos silenciosamente. Salidas de tipo INTERMEDIO o TERMINADO (decisión de cierre coherente con cadena); insumos de cualquier tipo existente utilizable. No balance obligatorio de masas.
- RN-114: Catálogos pueden reactivarse; producto inactivo no origina nuevos lotes, sí permite gestionar stock existente utilizable; ubicación activa para recepción/producción/distribución. No desactivar con existencias positivas incluso bloqueadas/caducadas.
- RN-115: Inspecciones inmutables. Parámetros tipados, sin claves extra, límites de admisibilidad no son reglas sanitarias. No editor de plantillas. Una versión activa por producto y una general activa; ausencia de ambas error de configuración.
- RN-116: Expedientes escritos solo por handler Mongo (creación/actualización outbox); version inicial 1, expectedVersion obligatorio para cambios, uno pendiente por incidencia, cambios parciales con reemplazo de arreglos. Validar referencias antes de aceptar; inspecciones pertinentes son las del origen o descendientes comprobados por relación productiva, independientemente del resultado. No aceptar referencias sin verificación; si Mongo/Neo requerido falla, 503. Para incidencia sin referencias puede seguir PG aun con Mongo caído.
- RN-117: Transición solo ABIERTA→EN_ANALISIS→CERRADA. Cierre exige estado documental SINCRONIZADO y resolución no vacía; verificar versión/estado bajo lock de incidencia; resolución detallada se guarda antes por expediente. Cierre sin evento Mongo; no editar expediente ni crear nuevos bloqueos tras cierre. Liberación individual sigue permitida.
- RN-118: Bloqueo manual máximo 100 lotes distintos, todos raíz o descendientes verificados, todo o nada; raíz no requiere Neo. Una ruta positiva en proyección histórica inmutable permite verificar descendiente incluso con eventos pendientes; ausencia con grafo parcial no es prueba negativa. Si no se puede verificar, 503 GRAPH_SYNC_PENDING o DATABASE_UNAVAILABLE; negativo concluyente 422 LOT_NOT_IN_IMPACT. Validar incidente activo bajo lock y coordinar locks de lotes con operaciones. No bloquear automáticamente.
- RN-119: Idempotency-Key UUID v4 obligatoria para recepciones, producción, distribución, inspección, creación/incidencia, actualización expediente, inicio/cierre, bloquear/liberar. Misma clave, actor, operación y solicitud normalizada → misma respuesta original aun si estado cambió; hash distinto → 409. Verificar auth antes de replay. SQL misma transacción; Mongo índice único por inspector/clave; no crear registro duplicado. Ver API.
- RN-120: Outbox secuencia serializada bajo lock exclusivo transaccional al final de operación; por destino orden ascendente, no saltar fallidos, un consumidor con lock de sesión dedicado por destino; replay idempotente y ACK SQL separado. No transacción SQL abierta durante escritura externa. Reintento transitorio 5s*2^(intentos-1) máximo 300s; fallos permanentes requieren intervención técnica, sin descartar; recuperación de PROCESANDO al adquirir lock exclusivo de consumidor. Ver DATA_MODEL/API.
- RN-121: Límites análisis profundidad 1..20 (default 10), máximo 10000 lotes contando raíces, comunes 2..5, caminos 1..50, máximo 500 nodos/1500 aristas visuales, deadline 10s. Detectar exceso real o advertir si no se pudo determinar; visual independiente. No persistir análisis ni afirmar snapshot distribuido.
- RN-122: Ancestros estrictos excluyen raíz; comunes intersección de todos; caminos dirigidos entre IDs distintos; SHORTEST uno con desempate estable, ALL acotado. Raíz aparece en grafo y en impacto, no listado de descendientes. Nivel mínimo por transformaciones; genealogía une direcciones sin propagar co-insumos.
- RN-123: Paginación normal 1.., limit 1..100 default 20; búsqueda max 150; ordenar campos permitidos con UUID desempate; análisis devuelve conjunto acotado y paginación local. No cargar historial completo en impacto.
- RN-124: Estados COMPLETO/PARCIAL/NO_DISPONIBLE y secciones con null si no disponible, jamás convertir error a cero. Comprobar outbox antes/después y cambios detectables; si no hay garantía, advertir. PG caído 503; Neo caído consulta principal 503; Mongo caído impacto parcial. Timeout sin resultado verificable 504.
- RN-125: JWT Bearer 8h, cuenta activa y rol actual comprobados en cada ruta; logout local y limpieza caché, no revocación individual/refresh. Hash Argon2id, credenciales privadas, límites login definidos en API.
- RN-126: No datos reales en fixtures. Sin modificaciones retroactivas, retiro físico ni anulación; no afirmar aptitud alimentaria. Reporte de impacto dinámico, no reproducibilidad exacta histórica del reporte.
- RN-127: Listados de no conformidades cuentan inspecciones, no lotes contaminados; por producto sin inspecciones porcentaje null; hallazgos cuentan elementos de arrays; selección de lotes distintos no conformes para comunes solo analista.

Los casos ampliados TP/PM/PG/PI/PS/E2E están en REQUIREMENTS.md. Las reglas nuevas son decisiones de cierre de la especificación, no evidencia de implementación. No cambiar sin revisión del equipo.
