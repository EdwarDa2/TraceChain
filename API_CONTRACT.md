# API_CONTRACT.md — contratos v1.0

Contrato normativo de implementación REST e integración. No es una API desplegada ni un OpenAPI ejecutado. Generar Swagger desde DTO reales y comprobar compatibilidad con estos tipos. Sustituye nombres de rutas, campos y formatos de v0.2. No introducir variantes de alias sin aprobación.

## 1. Convenciones
Base `/api/v1`, puerto 3001; JSON UTF-8. HTTPS en público, HTTP solo local. Swagger `/api/docs`, JSON `/api/docs-json` solo dev/test o restringido. Rutas en inglés, campos camelCase, DB snake_case español. Valores enumerados se conservan en español salvo tipos de consulta, advertencias, códigos técnicos y estado de fuentes. Todas las rutas protegidas salvo login y health; B=ambos, O=OPERADOR, A=ANALISTA_CALIDAD. JWT Bearer HS256, secret aleatorio al menos 32 bytes, claims sub=UUID, iat, exp, iss=tracechain, aud=tracechain-web; 8h (28800s), verificar firma, algoritmo, audiencia, emisor, expiración, cuenta activa y rol actual SQL. Argon2id; errores de credenciales indistinguibles; 5 intentos login/60s por IP, sin confiar en proxy no autorizado (decisión de cierre); 429 con Retry-After. No refresh, revocación individual ni endpoint logout; limpiar token y caché local. Token solo memoria; reload exige login. CORS origen explícito, Authorization, Content-Type, Idempotency-Key permitidos. No secretos en responses/logs.

Todos los éxitos: `{data:T}`; listados `{data:T[],meta:{page:number,limit:number,total:number,totalPages:number}}` (totalPages=0 si vacío). Errores `{error:{code:string,message:string,details:object|null,requestId:UUID}}`; requestId generado/registrado en servidor, cabecera X-Request-Id. No `success` adicional. 200 lectura/acción existente, 201 creación, 202 expediente aceptado, 400 estructura inválida, 401 auth, 403 rol, 404 entidad ausente, 409 conflicto estado, 422 regla de dominio, 429 límite, 500 inesperado, 503 autoridad no disponible, 504 timeout sin datos verificables. Respuesta de replay conserva status/body original. Campos opcionales en response presentes como null salvo campos dinámicos ausentes; arreglo disponible sin resultados [], fuente no disponible null + estado explícito.

Validaciones: UUID v4 canónico lowercase; códigos manuales trim uppercase regex ^[A-Z0-9_-]{1,50}$; INS-UUID excepción longitud 40, automático. Nombre 1..150, título 1..200, texto descripción/resolución/motivo 1..5000, notas hasta 3000, dirección hasta 500, contacto 150, teléfono 25, email 254 y formato válido. Rechazar strings requeridos vacíos. Qty string regex ^(0|[1-9][0-9]{0,14})\.[0-9]{3}$ y >0 en entrada; UNIDAD parte decimal 000; no redondear. Respuesta saldo no negativo, totales pueden superar rango individual; tres decimales. Instante ISO 8601 con zona, normalizar UTC salida con milisegundos; fecha civil YYYY-MM-DD. Fecha efectiva y caducidad RN-111. DTO class-validator/class-transformer whitelist + forbidNonWhitelisted; sin convertir boolean/número de body implícitamente; query strings se parsean explícitamente. Parameters dinámicos se validan contra plantilla. Formato UUID/JSON/campo desconocido 400; cantidad con formato/rango incompatibles 422. Null solo donde permitido. Límites de body JSON 1 MiB (decisión de cierre); 413 si excede. No aceptar ID de actor, estado oficial, código automático o unit calculado del cliente.

Paginación `page=1`, `limit=20` (1..100), `search` max150 (contains case-insensitive texto/código, escapar comodines SQL), `sortBy` allowlist de cada ruta, `sortOrder=asc|desc`, default desc salvo catálogo asc por code; UUID asc desempate. dateFrom/dateTo ISO UTC inclusivo inicio y exclusivo fin, dateFrom < dateTo. Filtros bool `true|false`. Omitidos sin filtro; activos/inactivos ambos por defecto; UI filtra activo para selección. IDs inexistentes en recurso individual 404; filtro sin coincidencia devuelve []. Cualquier propiedad query no autorizada 400. Endpoints sin listado no admiten paginación salvo expresamente. Listados convencionales desde backend. No paginar grafo reejecutando análisis, devolver conjunto acotado y paginar en UI.

## 2. Tipos compartidos (notación normativa)
Tipos TypeScript estructurales, no dependientes de frameworks; `?` solo en requests opcionales. Response `|null` explícito. Intersección `&` incluye todos campos. Arrays vacíos válidos cuando no hay datos. UUID, Instant, CivilDate, Quantity, DecimalString son aliases string validados; enum según DATA_MODEL/BUSINESS_RULES. `Count` entero no negativo seguro en JSON. DTO concretos y OpenAPI deben corresponder campo por campo. Tipos de entrada y salida separados.

```ts
type UUID = string; type Instant = string; type CivilDate = string;
type Quantity = string; type DecimalString = string; type Count = number;
type Role = 'OPERADOR'|'ANALISTA_CALIDAD';
type ProductType = 'MATERIA_PRIMA'|'INTERMEDIO'|'TERMINADO';
type Unit = 'KG'|'G'|'L'|'ML'|'UNIDAD';
type LocationType = 'ALMACEN'|'PLANTA_PRODUCCION'|'SUCURSAL';
type OriginType = 'RECEPCION'|'PRODUCCION';
type Severity = 'BAJA'|'MEDIA'|'ALTA';
type IncidentType = 'CALIDAD'|'EMPAQUE'|'ALMACENAMIENTO'|'OTRO';
type IncidentStatus = 'ABIERTA'|'EN_ANALISIS'|'CERRADA';
type SyncStatus = 'PENDIENTE'|'SINCRONIZADO'|'ERROR';
type InspectionResult = 'CONFORME'|'NO_CONFORME';
type DataType = 'TEXTO'|'ENTERO'|'DECIMAL'|'BOOLEANO'|'SELECCION';
type FindingType = 'IMPUREZAS'|'HUMEDAD'|'PESO'|'EMPAQUE'|'APARIENCIA'|'TEXTURA'|'TEMPERATURA'|'OTRO';
type EvidenceType = 'IMAGEN'|'DOCUMENTO'|'REFERENCIA';
type MovementType = 'RECEPCION'|'CONSUMO_PRODUCCION'|'RESULTADO_PRODUCCION'|'DISTRIBUCION_SALIDA'|'DISTRIBUCION_ENTRADA';
type User = {id:UUID;name:string;email:string;role:Role};
type Login = {email:string;password:string};
type LoginResult = {accessToken:string;tokenType:'Bearer';expiresIn:number;user:User};
type Base = {id:UUID;code:string};
type Audit = {createdAt:Instant;updatedAt:Instant};
type SupplierCreate = {code:string;name:string;contactName?:string|null;email?:string|null;phone?:string|null;address?:string|null};
type Supplier = Base & Audit & {name:string;contactName:string|null;email:string|null;phone:string|null;address:string|null;active:boolean};
type SupplierPatch = Partial<Omit<SupplierCreate,'code'>>;
type ProductCreate = {code:string;name:string;description?:string|null;type:ProductType;unit:Unit};
type Product = Base & Audit & {name:string;description:string|null;type:ProductType;unit:Unit;active:boolean};
type ProductPatch = Partial<Omit<ProductCreate,'code'>>;
type LocationCreate = {code:string;name:string;type:LocationType;address?:string|null};
type Location = Base & Audit & {name:string;type:LocationType;address:string|null;active:boolean};
type LocationPatch = Partial<Omit<LocationCreate,'code'>>;
type StatusPatch = {active:boolean};
type ReceiptCreate = {code:string;productId:UUID;supplierId:UUID;supplierLotCode?:string|null;locationId:UUID;quantity:Quantity;receivedAt:Instant;expirationDate?:CivilDate|null};
type Lot = Base & {productId:UUID;productName:string;productType:ProductType;supplierId:UUID|null;supplierLotCode:string|null;originType:OriginType;initialQuantity:Quantity;originAt:Instant;expirationDate:CivilDate|null;unit:Unit;registeredBy:UUID;createdAt:Instant;physicalQuantity:Quantity;usableQuantity:Quantity;blocked:boolean;expired:boolean;exhausted:boolean;graphSyncStatus:SyncStatus};
type ReceiptResult = Pick<Lot,'id'|'code'|'initialQuantity'|'unit'|'originType'|'graphSyncStatus'>;
type Stock = {lotId:UUID;lotCode:string;productId:UUID;productName:string;locationId:UUID;locationName:string;physicalQuantity:Quantity;usableQuantity:Quantity;unit:Unit;blocked:boolean;expired:boolean;updatedAt:Instant};
type Movement = {id:UUID;lotId:UUID;locationId:UUID;type:MovementType;direction:'ENTRADA'|'SALIDA';quantity:Quantity;beforeQuantity:Quantity;afterQuantity:Quantity;unit:Unit;productionOrderId:UUID|null;distributionId:UUID|null;actorId:UUID;movementAt:Instant;createdAt:Instant};
type LotQuantity = {lotId:UUID;quantity:Quantity};
type OutputCreate = {code:string;productId:UUID;quantity:Quantity;expirationDate?:CivilDate|null};
type ProductionCreate = {name:string;locationId:UUID;producedAt:Instant;notes?:string|null;inputs:LotQuantity[];outputs:OutputCreate[]};
type ProductionSummary = Base & {name:string;locationId:UUID;producedAt:Instant;inputCount:Count;outputCount:Count;graphSyncStatus:SyncStatus};
type ProductionInput = LotQuantity & {id:UUID;lotCode:string;unit:Unit};
type ProductionOutput = ProductionInput & {productId:UUID;expirationDate:CivilDate|null};
type Production = ProductionSummary & {notes:string|null;actorId:UUID;createdAt:Instant;inputs:ProductionInput[];outputs:ProductionOutput[]};
type DistributionCreate = {originLocationId:UUID;destinationLocationId:UUID;distributedAt:Instant;notes?:string|null;items:LotQuantity[]};
type DistributionSummary = Base & {originLocationId:UUID;destinationLocationId:UUID;distributedAt:Instant;itemCount:Count;graphSyncStatus:SyncStatus};
type Distribution = DistributionSummary & {actorId:UUID;notes:string|null;createdAt:Instant;items:ProductionInput[]};
type TemplateParameter = {key:string;label:string;dataType:DataType;unit:string|null;required:boolean;options:string[];min:DecimalString|null;max:DecimalString|null};
type Template = Base & {name:string;description:string|null;productId:UUID|null;version:number;parameters:TemplateParameter[];active:boolean;createdAt:Instant};
type Finding = {type:FindingType;parameter:string|null;description:string;severity:Severity};
type EvidenceCreate = {type:EvidenceType;reference:string;description?:string|null};
type Evidence = {type:EvidenceType;reference:string;description:string|null;registeredAt:Instant};
type Parameters = Record<string,string|number|boolean>;
type InspectionCreate = {lotId:UUID;templateId:UUID;templateVersion:number;inspectedAt:Instant;parameters:Parameters;result:InspectionResult;findings:Finding[];notes?:string|null;evidence:EvidenceCreate[]};
type Inspection = Base & {lotId:UUID;productId:UUID;templateId:UUID;templateVersion:number;inspectorId:UUID;inspectedAt:Instant;parameters:Parameters;result:InspectionResult;findings:Finding[];notes:string|null;evidence:Evidence[];createdAt:Instant};
type InspectionCreated = Pick<Inspection,'id'|'code'|'lotId'|'result'|'createdAt'> & {findingsCount:Count};
type QualityCount = {total:Count;conforming:Count;nonConforming:Count;nonConformingPercentage:number|null};
type QualitySummary = {totalInspections:Count;conforming:Count;nonConforming:Count;nonConformingPercentage:number|null;byProduct:(QualityCount & {productId:UUID;productName:string})[]};
type FindingCount = {key:FindingType|Severity;count:Count};
type IncidentCreate = {originLotId:UUID;title:string;type:IncidentType;severity:Severity;detectedAt:Instant;description:string;inspectionIds:UUID[];findings:Finding[];evidence:EvidenceCreate[];notes?:string|null};
type Incident = Base & Audit & {originLotId:UUID;title:string;type:IncidentType;severity:Severity;status:IncidentStatus;dossierStatus:SyncStatus;reportedBy:UUID;detectedAt:Instant;closedAt:Instant|null;closedBy:UUID|null;resolution:string|null};
type IncidentCreated = Pick<Incident,'id'|'code'|'status'|'dossierStatus'>;
type Dossier = {id:UUID;incidentId:UUID;description:string;inspectionIds:UUID[];findings:Finding[];evidence:Evidence[];notes:string|null;detailedResolution:string|null;version:number;createdAt:Instant;updatedAt:Instant};
type DossierPatch = {expectedVersion:number;description?:string;inspectionIds?:UUID[];findings?:Finding[];evidence?:EvidenceCreate[];notes?:string|null;detailedResolution?:string|null};
type DossierAccepted = {incidentId:UUID;currentVersion:number;expectedVersion:number;dossierStatus:'PENDIENTE'};
type CloseIncident = {resolution:string};
type BlockCreate = {lotIds:UUID[];reason:string};
type Block = {id:UUID;lotId:UUID;incidentId:UUID;reason:string;blockedBy:UUID;blockedAt:Instant;active:boolean;releasedBy:UUID|null;releasedAt:Instant|null;releaseReason:string|null};
type ReleaseBlock = {reason:string};
type ReleaseResult = {blockId:UUID;active:false;lotId:UUID;lotBlocked:boolean;remainingActiveBlocks:Count};
```
Quality percentages JSON number rounded to 2 decimal places, null if denominator zero; no inventory float. Dossier patch at least one mutable field; omitted leaves unchanged, null clears nullable only, arrays replace whole; evidence dates set by server on new array. Required arrays can empty unless constraints. Template version positive Int32. Finding.parameter null for dossiers; inspections key defined or null. Dynamic decimal is string parse exact Decimal128, finite, no exponent (canonical plain decimal), up to 34 significant digits; ENTERO Int32; BOOLEANO actual bool; TEXTO 1..3000 chars; SELECCION exact options. Findings/evidence limits from DATA_MODEL. Inspection references distinct and verified. `graphSyncStatus` calculated from relevant outbox event(s) for record, never stored as separate lot flag; if no event or projection unverifiable, error/pending not silently synchronized.

## 3. Endpoints (prefijo /api/v1 implícito)
En filas listadas `P` significa parámetros comunes page/limit/sortBy/sortOrder; search solo indicado. Campo de sort default primer campo listado y dirección según catálogo o desc. `I` requiere Idempotency-Key, `—` cuerpo/query vacío. Respuestas se envuelven en data, listados incluyen meta. Todos los GET exitosos 200; POST creación 201; acciones POST lectura/estado 200 salvo especificado. PATCH catálogo 200.

| Método y ruta | Rol | Request / filtros permitidos | Respuesta / status | Consulta/dueño |
|---|---|---|---|---|
| POST /auth/login | Público | Login | LoginResult 200 | I-1 |
| GET /auth/me | B | — | User | I-1 |
| GET /suppliers | B | P, search, active; sort code/name/createdAt | Supplier[] | QP-01 I-1 |
| GET /suppliers/:id | B | — | Supplier | I-1 |
| POST /suppliers | O | SupplierCreate | Supplier 201 | I-1 |
| PATCH /suppliers/:id | O | SupplierPatch | Supplier | I-1 |
| PATCH /suppliers/:id/status | O | StatusPatch | Supplier | I-1 |
| GET /products | B | P, search, type, active; sort code/name/createdAt | Product[] | QP-02 I-1 |
| GET /products/:id | B | — | Product | I-1 |
| POST /products | O | ProductCreate | Product 201 | I-1 |
| PATCH /products/:id | O | ProductPatch | Product | I-1 |
| PATCH /products/:id/status | O | StatusPatch | Product | I-1 |
| GET /locations | B | P, search, type, active; sort code/name/createdAt | Location[] | QP-03 I-1 |
| GET /locations/:id | B | — | Location | I-1 |
| POST /locations | O | LocationCreate | Location 201 | I-1 |
| PATCH /locations/:id | O | LocationPatch | Location | I-1 |
| PATCH /locations/:id/status | O | StatusPatch | Location | I-1 |
| GET /lots | B | P, search, productId,supplierId,expired,blocked; sort originAt/code | Lot[] | QP-04 I-1 |
| GET /lots/:id | B | — | Lot | QP-05 I-1 |
| POST /lots/receipts | O | ReceiptCreate, I | ReceiptResult 201 | I-1 |
| GET /inventory | B | P, search, lotId,productId,supplierId,locationId,blocked,expired; sort updatedAt/lotCode | Stock[] | QP-06 I-1 |
| GET /inventory/movements | B | P, lotId,locationId,type,productionOrderId,distributionId,dateFrom,dateTo; sort movementAt/createdAt | Movement[] | QP-07 I-1 |
| GET /lots/:id/details | B | — | LotDetails | QI-01 I-1 coordina |
| GET /production-orders | B | P, search, locationId,dateFrom,dateTo; sort producedAt/code | ProductionSummary[] | QP-08 I-1 |
| GET /production-orders/:id | B | — | Production | QP-09 I-1 |
| POST /production-orders | O | ProductionCreate, I | Production 201 | I-1 |
| GET /distributions | B | P, search, originLocationId,destinationLocationId,lotId,dateFrom,dateTo; sort distributedAt/code | DistributionSummary[] | QP-10 I-1 |
| GET /distributions/:id | B | — | Distribution | QP-11 I-1 |
| POST /distributions | O | DistributionCreate, I | Distribution 201 | I-1 |
| GET /inspection-templates/active | B | productId obligatorio | Template | QM-01 I-2 |
| GET /inspection-templates/:id | B | — | Template histórica/activa | I-2 |
| GET /inspections | B | P, lotId,productId,result,dateFrom,dateTo; sort inspectedAt/code | Inspection[] | QM-02/03/04 I-2 |
| GET /inspections/:id | B | — | Inspection | I-2 |
| POST /inspections | A | InspectionCreate, I | InspectionCreated 201 | I-2 |
| GET /quality/summary | B | productId,dateFrom,dateTo | QualitySummary | QM-05/06 I-2 |
| GET /quality/findings | B | productId,dateFrom,dateTo,groupBy=type(default)/severity, limit=20 (1..100) | FindingCount[] | QM-07/08 I-2 |
| GET /incidents | B | P, search, status,severity,originLotId,dateFrom,dateTo; sort detectedAt/code | Incident[] | QP-12 I-2 |
| GET /incidents/:id | B | — | IncidentDetail | QI-02 I-2 |
| POST /incidents | A | IncidentCreate, I | IncidentCreated 201 | I-2 |
| GET /incidents/:id/dossier | B | — | DossierView | QM-09 I-2 |
| PATCH /incidents/:id/dossier | A | DossierPatch, I | DossierAccepted 202 | I-2 |
| POST /incidents/:id/start-analysis | A | —, I | Incident 200 | I-2 |
| POST /incidents/:id/close | A | CloseIncident, I | Incident 200 | I-2 |
| GET /incidents/:id/blocks | B | P, active; sort blockedAt | Block[] | QP-14 I-2 |
| POST /incidents/:id/blocks | A | BlockCreate, I | Block[] 201 (sin meta) | I-2 |
| GET /lots/:id/blocks | B | P, active; sort blockedAt | Block[] | QP-14 I-2 |
| POST /lot-blocks/:id/release | A | ReleaseBlock, I | ReleaseResult 200 | I-2 |
| GET /traceability/:lotId/forward | B | maxDepth | TraceResult | QG-01/02/09/10/12 I-3 |
| GET /traceability/:lotId/backward | B | maxDepth | TraceResult | QG-03/04/08/09/12 I-3 |
| GET /traceability/:lotId/genealogy | B | maxDepth | TraceResult | QG-02/04/12 I-3 |
| POST /traceability/common-origins | A | CommonOriginsRequest | TraceResult 200 | QG-05/12 I-3 |
| POST /traceability/paths | B | PathsRequest | TraceResult 200 | QG-06/07/12 I-3 |
| GET /incidents/:id/impact | B | maxDepth | ImpactResult | QI-03 I-3 (único controller) |
| GET /dashboard/summary | B | — | DashboardSummary | QP-15 I-1 |
| GET /dashboard/recent-activity | B | limit=10, 1..50 | Activity[] | QP-15 I-1 |
| GET /system/sync-status | B | — | SystemStatus | QI-06 I-1 |
| GET /health | Público | — | Health | I-1 |

No rutas DELETE, edición de operación histórica, editor plantilla, stock manual, nodos CRUD, cola manual, registro usuario, refresh/logout servidor. Rutas literales (/active, /receipts, etc.) no deben confundirse con parámetros. PATCH catálogo requiere al menos un campo; code/id immutable; unidad/tipo producto solo antes de lotes. Mutaciones de catálogos pueden ser reintentadas con estado final pero no requieren cabecera I; códigos únicos previenen duplicados. Producción 1..50 inputs distintos, 1..20 outputs códigos distintos; distribución 1..50 items distintos; block 1..100 lotIds distintos, justificación; atomicidad. Fechas y stock RN-111/113. No edición de inspección. No usar el nombre de producto enviado por cliente. Listado de no conformes por inspecciones; selección de lotes distintos UI. Quality findings ordenar count desc/key asc. Dossier GET: 200 con null y estado PENDIENTE/ERROR si no escrito o no consultable; 404 solo incidencia inexistente. Si documento de versión anterior disponible, mostrar con estado PARCIAL. Cierre desde EN_ANALISIS y expediente sincronizado; liberar bloqueo activo solo una vez (replay idempotente). Si nueva solicitud intenta liberar inactivo, 409 BLOCK_ALREADY_RELEASED.

## 4. Contratos de lectura integrada y grafo
```ts
type AnalysisStatus = 'COMPLETO'|'PARCIAL'|'NO_DISPONIBLE';
type WarningCode = 'DEPTH_LIMIT'|'RESULT_LIMIT'|'PATH_LIMIT'|'GRAPH_PENDING'|'DOCUMENT_PENDING'|'QUALITY_UNAVAILABLE'|'GRAPH_UNAVAILABLE'|'TIME_LIMIT'|'CONCURRENT_CHANGES'|'DETAIL_LIMIT';
type Warning = {code:WarningCode;message:string};
type SourceStatus = {availability:'AVAILABLE'|'UNAVAILABLE';sync:'SYNCHRONIZED'|'PENDING'|'ERROR'|'NOT_APPLICABLE';checkedAt:Instant;pendingEvents:Count|null};
type Sources = {postgresql:SourceStatus;mongodb:SourceStatus|null;neo4j:SourceStatus|null};
type Section<T> = {status:AnalysisStatus;data:T|null;warnings:Warning[]};
type DossierView = {dossierStatus:SyncStatus;status:AnalysisStatus;dossier:Dossier|null;inspections:Inspection[]|null;warnings:Warning[]};
type IncidentDetail = Incident & {dossier:DossierView;blocks:Block[];sourceStatus:Sources};
type CommonOriginsRequest = {lotIds:UUID[];maxDepth?:number};
type PathsRequest = {sourceLotId:UUID;targetLotId:UUID;mode:'SHORTEST'|'ALL';maxDepth?:number;maxPaths?:number};
type NodeType = 'Proveedor'|'Producto'|'Lote'|'Proceso'|'Distribucion'|'Ubicacion';
type EdgeType = 'SUMINISTRA'|'CORRESPONDE_A'|'UTILIZADO_EN'|'GENERA'|'INCLUIDO_EN'|'SALE_DE'|'ENTREGADO_A';
type GraphNode = {id:string;entityId:UUID;type:NodeType;label:string;name:string;depth:number|null};
type GraphEdge = {id:string;source:string;target:string;type:EdgeType;quantity:Quantity|null;unit:Unit|null};
type Graph = {nodes:GraphNode[];edges:GraphEdge[]};
type TraceLot = {lotId:UUID;code:string;productId:UUID;productName:string;productType:ProductType;depth:number;direction:'FORWARD'|'BACKWARD'|'BOTH'|'COMMON'|'PATH';depthByRoot:Record<UUID,number>|null};
type TracePath = {nodeIds:string[];edgeIds:string[];depth:number};
type Destination = {distributionId:UUID;distributionCode:string;lotId:UUID;locationId:UUID;locationName:string;distributedAt:Instant;transferredQuantity:Quantity;unit:Unit};
type TraceSupplier = {supplierId:UUID;code:string;name:string;lotId:UUID};
type TraceProcess = {processId:UUID;code:string;name:string;producedAt:Instant};
type AnalysisMeta = {maxDepth:number;analysisTruncated:boolean;visualizationTruncated:boolean;graphSynchronized:boolean|null;warnings:Warning[];durationMs:number;analyzedAt:Instant;sourceStatus:Sources};
type TraceSummary = {directLots:Count|null;indirectLots:Count|null;totalDescendants:Count|null;totalAncestors:Count|null;totalCommonLots:Count|null;pathsReturned:Count|null;minPathDepth:number|null;uniqueLots:Count};
type TraceResult = {status:AnalysisStatus;queryType:'FORWARD'|'BACKWARD'|'GENEALOGY'|'COMMON_ORIGINS'|'PATHS';rootLotIds:UUID[];summary:TraceSummary;lots:TraceLot[];paths:TracePath[];destinations:Destination[];suppliers:TraceSupplier[];processes:TraceProcess[];graph:Graph;metadata:AnalysisMeta};
type ImpactLot = {lotId:UUID;code:string;productId:UUID;productName:string;classification:'ORIGEN'|'DIRECTO'|'INDIRECTO';depth:number;unit:Unit;physicalQuantity:Quantity;usableQuantity:Quantity;blocked:boolean};
type LotQuality = {lotId:UUID;totalInspections:Count;conforming:Count;nonConforming:Count;latestInspectionId:UUID|null};
type ImpactQuality = {dossier:DossierView;byLot:LotQuality[]};
type ImpactSummary = {originLots:1;directLots:Count;indirectLots:Count;totalAffectedLots:Count;destinationCount:Count;blockedLots:Count};
type ImpactResult = {status:AnalysisStatus;queryType:'IMPACT';incident:Incident;originLot:Lot;summary:ImpactSummary;affectedLots:ImpactLot[];stockByLocation:Section<Stock[]>;destinations:Section<Destination[]>;quality:Section<ImpactQuality>;blocks:Section<Block[]>;graph:Graph;metadata:AnalysisMeta};
type LotDetails = {lot:Lot;supplier:Supplier|null;stocks:Section<Stock[]>;quality:Section<LotQuality>;genealogy:Section<TraceResult>;incidents:Incident[];activeBlocks:Block[];sourceStatus:Sources;status:AnalysisStatus;warnings:Warning[]};
type DashboardSummary = {totalLots:Count;totalProductions:Count;activeIncidents:Count;blockedLots:Count};
type Activity = {type:'RECEPCION'|'PRODUCCION'|'DISTRIBUCION'|'INCIDENCIA';entityId:UUID;code:string;occurredAt:Instant;description:string};
type SyncMotor = {destination:'NEO4J'|'MONGODB';pending:Count;processing:Count;failed:Count;completed:Count;lastProcessedAt:Instant|null;lastCompletedSequence:string|null;headSequence:string|null;status:SyncStatus};
type SystemStatus = {status:'AVAILABLE'|'DEGRADED';sources:Sources;sync:SyncMotor[]};
type Health = {status:'ok'|'degraded'|'unavailable'};
```
GraphNode.id = `${type}:${entityId}`. GraphEdge.id = `${type}:${storedRelationshipId}` except stored id already begins same type prefix, then keep once; source/target point to GraphNode.id. Label code, name product/process/location display (Distribucion use code if no name). depth for lot, null others; roots depth 0; common depth=min across roots, depthByRoot required only commons, otherwise null. TraceLot excludes roots; path mode lists intermediate lots (source/target in rootLotIds and graph), minimum depth from source; common lots ancestors strictly of every root. Genealogy dedup union with direction and min depth; in acyclic graph no nonroot BOTH expected. Summary irrelevant fields null, counts only returned/verified within scope; destinations count unique locationId. Paths nodeIds/edgeIds reference stable visual IDs even if graph truncated; paths are independent of visual subgraph. `SHORTEST` returns one shortest deterministic path; `ALL` maxPaths default 50 and 1..50; no self path. `maxDepth` default10 range1..20, common 2..5 distinct. `paths/destinations/suppliers/processes` [] if not applicable; if applicable but incomplete, warnings + status PARCIAL. Graph always real edges, no orphan endpoints. UI collapse virtual edges clearly marked; no mutation. Limit 10000 analyzed lots including roots, 500 visual nodes/1500 edges, 10s deadline. Root-only no descendants valid if complete. If cap or depth excludes actual results or cannot verify, mark analysisTruncated true and warning. If only visual exceeds, visualizationTruncated true but status can COMPLETO. List of paths truncated only if 51st exists or uncertain (warning). For common/path with bounded search, no path/common result does not assert global absence if partial. Sort results level then code then UUID, paths length then ID sequence; destinations time then distributionId/lotId. Enrichment SQL for official quantities, name from authority if available.

Impact: origin included in affectedLots and summary.totalAffectedLots; direct/indirect exclude origin. Physical/utilizable quantities official SQL, not graph. `stockByLocation` rows keyed lot/location, `destinations` historical transfer entries keyed distribution/lot (not unique units), `blocks` active per affected lot, `quality.byLot` summaries not full history. For detail arrays cap 10000 rows per section, stable order, `DETAIL_LIMIT` warning with section PARCIAL; full records via paginated endpoints. Summary counts reflect verified lot set, and destinationCount from actual known set before detail cap if calculated; if cannot compute, status PARCIAL and counts reflect returned subset (UI label “al menos”). `LotDetails` uses paginated movements, inspections, blocks via endpoints; genealogy default10, stock/incident lists cap10000 and warning; activeBlocks only active. Dossier includes referenced inspections max50. IncidentDetail.blocks cap10000, paginated endpoint for rest; status source warnings in dossier/sourceStatus (UI use list). Quality no inspections valid total=0; cannot query -> null and warning. If Mongo unavailable during impact, section null/NO_DISPONIBLE, overall PARCIAL; if dossier pending and inspections available, return those with dossier state and PARCIAL. If Neo unavailable main trace/impact -> 503, detail lot genealogy section null; if root absent Neo but exists SQL and events pending -> 503 GRAPH_SYNC_PENDING; if no pending and projection missing -> 503 GRAPH_INCONSISTENT (not 404). If PG unavailable protected operations 503, not partial official data. Deadline elapsed with verified partial results 200 PARCIAL/TIME_LIMIT, without 504. No 206. Source availability reflects actual query, sync is conservatively checked before/after analysis; concurrent changes detected -> PARCIAL. Not a distributed snapshot. Public health 200 ok/degraded if app+PG ready, 503 with standard error if unavailable; no detail secrets. System status authenticated, secondary degraded independently. Dashboard count active incidents includes ABIERTA+EN_ANALISIS, blocked distinct lots with active blocks, activity SQL only (reception/production/distribution/incident), not inspections.

## 5. Idempotencia
Cabecera `Idempotency-Key` UUID v4 para I. Scope SQL actor + operación canónica (método + patrón ruta, por ejemplo POST /incidents/:id/close) + clave; hash SHA256 de JSON canónico normalizado `{pathParams,body}` con claves objetos ordenadas recursivamente, arrays conservan orden, valores normalizados por DTO (fechas UTC, códigos trim uppercase, cantidades exactas, opcionales ausentes equivalentes a null solo si semántica igual; en PATCH omitido vs null distintos). Verificar auth/forma y replay antes de reglas dependientes del estado, reservar lock transaccional por scope, validar hash; guardar response status/body original en mismo commit. Sin guardar fallos no confirmados. Mongo inspección scope inspector/clave y mismo hash; buscar antes de verificar estado plantilla, insertar único, ante duplicate key recuperar ganador y comparar. No usar claves distintas para retry de misma intención; nueva operación nueva clave. HTTP 400 IDEMPOTENCY_KEY_REQUIRED si ausente/inválida; 409 IDEMPOTENCY_CONFLICT si distinto. Cliente conserva clave mientras reintenta y no repite automáticamente mutaciones no idempotentes.

## 6. Catálogo de errores
| Código | HTTP | Cuándo |
|---|---:|---|
| VALIDATION_ERROR | 400 | Forma/UUID/propiedad/query no válida |
| IDEMPOTENCY_KEY_REQUIRED | 400 | Cabecera faltante o inválida |
| INVALID_CREDENTIALS | 401 | Login inválido |
| UNAUTHORIZED | 401 | Token ausente/inválido o usuario inactivo |
| TOKEN_EXPIRED | 401 | Expiración |
| FORBIDDEN | 403 | Rol no autorizado |
| RESOURCE_NOT_FOUND | 404 | Recurso oficial inexistente |
| DUPLICATE_CODE | 409 | Código existente |
| INSUFFICIENT_STOCK | 409 | Stock local insuficiente |
| LOT_BLOCKED | 409 | Restricción activa |
| LOT_EXPIRED | 409 | Caducado |
| INACTIVE_RESOURCE | 409 | Catálogo no elegible |
| LOCATION_HAS_STOCK | 409 | Desactivación prohibida |
| IMMUTABLE_FIELD | 409 | Campo protegido |
| IDEMPOTENCY_CONFLICT | 409 | Misma clave distinto hash |
| DOSSIER_PENDING | 409 | Expediente no sincronizado para cambio/cierre |
| VERSION_CONFLICT | 409 | expectedVersion incorrecta |
| INVALID_INCIDENT_TRANSITION | 409 | Estado incompatible |
| INCIDENT_CLOSED | 409 | Incidencia cerrada para mutación |
| BLOCK_ALREADY_ACTIVE | 409 | Restricción duplicada |
| BLOCK_ALREADY_RELEASED | 409 | Bloqueo ya liberado |
| INVALID_QUANTITY | 422 | Rango, escala o unidad inválida |
| INVALID_TEMPLATE | 422 | Plantilla inactiva/incorrecta |
| INVALID_INSPECTION_PARAMETERS | 422 | Validación dinámica/falta hallazgo |
| INVALID_OPERATION_DATE | 422 | Fecha fuera de reglas |
| LOT_NOT_IN_IMPACT | 422 | Dependencia descartada concluyentemente |
| INVALID_REFERENCE | 422 | Referencia no pertinente o duplicada |
| INVALID_OPERATION | 422 | Origen=destino, salida no elegible, etc. |
| PAYLOAD_TOO_LARGE | 413 | JSON superior al límite |
| RATE_LIMITED | 429 | Límite login |
| INTERNAL_ERROR | 500 | Error inesperado sanitizado |
| GRAPH_SYNC_PENDING | 503 | Proyección pendiente/verificación inconclusa |
| GRAPH_INCONSISTENT | 503 | Proyección inválida sin pendiente explicativo |
| TEMPLATE_UNAVAILABLE | 503 | Ninguna plantilla activa aplicable |
| DATABASE_UNAVAILABLE | 503 | Fuente necesaria caída |
| QUERY_TIMEOUT | 504 | Deadline sin resultado verificable |

Ejemplo de error: `{"error":{"code":"INSUFFICIENT_STOCK","message":"El lote no tiene existencias suficientes.","details":{"lotCode":"MP-001","requestedQuantity":"120.000","availableQuantity":"100.000"},"requestId":"00000000-0000-4000-8000-000000000001"}}`.

## 7. Eventos internos v1
Envelopes, no HTTP. DB `payload` JSONB guarda `{payloadVersion:1,payload:...}`; metadata de otras columnas. Campos de payload camelCase como tipos del paquete; handler mapea a snake_case. Fechas estables del evento; secuencia string BIGINT. No reconstruir payload a partir de información que haya cambiado. Sin credenciales ni objetos de driver. El evento de catálogo refleja snapshot de propiedades proyectadas; eventos de operaciones deben incluir todos IDs extremos. `EventEnvelope` discriminado por eventType; entityType SUPPLIER/PRODUCT/LOCATION/LOT/PRODUCTION/DISTRIBUTION/INCIDENT, entityId de registro oficial; destination NEO4J/MONGODB. `occurredAt` = fecha registro del evento, no fecha efectiva; fechas efectivas en payload. `eventId` UUID, `sequence` string, `payloadVersion` literal 1.

```ts
type SupplierProjection = {id:UUID;code:string;name:string;active:boolean};
type ProductProjection = SupplierProjection & {type:ProductType;unit:Unit};
type LocationProjection = SupplierProjection & {type:LocationType};
type LotProjection = {id:UUID;code:string;productId:UUID;originType:OriginType;originAt:Instant};
type ProcessProjection = {id:UUID;code:string;name:string;locationId:UUID;producedAt:Instant};
type RelationQuantity = {id:UUID;lotId:UUID;quantity:Quantity;unit:Unit};
type DossierFields = {description:string;inspectionIds:UUID[];findings:Finding[];evidence:Evidence[];notes:string|null;detailedResolution:string|null};
type EventPayloadMap = {
 PROVEEDOR_CREADO:{supplier:SupplierProjection};
 PRODUCTO_CREADO:{product:ProductProjection};
 UBICACION_CREADA:{location:LocationProjection};
 CATALOGO_ACTUALIZADO:
   {entityType:'SUPPLIER';supplier:SupplierProjection}|
   {entityType:'PRODUCT';product:ProductProjection}|
   {entityType:'LOCATION';location:LocationProjection};
 LOTE_RECIBIDO:{lot:LotProjection;supplierId:UUID};
 PRODUCCION_REGISTRADA:{process:ProcessProjection;inputs:RelationQuantity[];outputs:{id:UUID;lot:LotProjection;quantity:Quantity;unit:Unit}[]};
 DISTRIBUCION_REGISTRADA:{distribution:{id:UUID;code:string;distributedAt:Instant;originLocationId:UUID;destinationLocationId:UUID};items:RelationQuantity[]};
 INCIDENCIA_REGISTRADA:{incidentId:UUID;dossierId:UUID;version:1;fields:DossierFields};
 EXPEDIENTE_ACTUALIZADO:{incidentId:UUID;expectedVersion:number;nextVersion:number;changes:Partial<DossierFields>};
};
type EventType = keyof EventPayloadMap;
type EventEnvelope<K extends EventType = EventType> = {eventId:UUID;sequence:string;eventType:K;entityType:'SUPPLIER'|'PRODUCT'|'LOCATION'|'LOT'|'PRODUCTION'|'DISTRIBUTION'|'INCIDENT';entityId:UUID;destination:'NEO4J'|'MONGODB';payloadVersion:1;occurredAt:Instant;payload:EventPayloadMap[K]};
```
Destino Neo para primeros siete eventos; Mongo para últimos dos. No INCIDENCIA_CERRADA obligatorio (sustituye propuesta antigua). Actualización nextVersion=expectedVersion+1, changes al menos uno; evidencia fecha asignada antes de encolar. Validar discriminante/versión en handler; error permanente si incompatibilidad. Transacción única Neo y CAS Mongo; ACK SQL y estado expediente en misma transacción. Los handlers nunca generan nuevas operaciones de inventario. Reintentos protocolo DATA_MODEL. Ejemplo producción (IDs simbólicos, ejemplo de forma):
```json
{"eventType":"PRODUCCION_REGISTRADA","payloadVersion":1,"payload":{"process":{"id":"UUID_OP","code":"OP-000001","name":"Elaboración de masa","locationId":"UUID_UB","producedAt":"2026-11-25T16:00:00Z"},"inputs":[{"id":"UUID_CONSUMO","lotId":"UUID_MP","quantity":"30.000","unit":"KG"}],"outputs":[{"id":"UUID_RESULTADO","lot":{"id":"UUID_LP","code":"LP-001","productId":"UUID_PRD","originType":"PRODUCCION","originAt":"2026-11-25T16:00:00Z"},"quantity":"28.000","unit":"KG"}]}}
```
Ejemplo parcial de envelope, no fixture canónico; no usar IDs simbólicos en llamadas reales.

## 8. Interfaces internas (firmas de coordinación)
Contratos de dominio exportados desde packages/contracts; `Tx` es contexto opaco en backend que encapsula PoolClient, no exportar driver al paquete frontend. Definir tokens DI Symbol con nombre único, implementar providers y exportar desde módulos correspondientes. No abrir transacciones anidadas ni acceder a repos ajenos. `Actor` = User; `ReadOptions` = `{tx?:Tx}`; fechas/reloj inyectable; errores normalizados. Repositorio retorna entidad o null, servicio convierte a 404. Métodos de mutación reciben tx obligatorio. `LotWriter` y `InventoryWriter` solo I-1. El orquestador de incidencias I-2 usa TransactionManager y repositorios/ports SQL I-1.
```ts
interface TransactionManager { run<T>(work:(tx:Tx)=>Promise<T>):Promise<T> }
interface LotReader { find(id:UUID,opts?:ReadOptions):Promise<Lot|null>; findMany(ids:UUID[],opts?:ReadOptions):Promise<Lot[]>; }
interface ProductReader { find(id:UUID,opts?:ReadOptions):Promise<Product|null>; findMany(ids:UUID[],opts?:ReadOptions):Promise<Product[]>; }
interface InventoryReader { byLots(ids:UUID[],opts?:ReadOptions):Promise<Stock[]>; byLotLocation(lotId:UUID,locationId:UUID,opts?:ReadOptions):Promise<Stock|null>; }
interface InventoryWriter { lockLots(ids:UUID[],tx:Tx):Promise<void>; changeStock(input:{lotId:UUID;locationId:UUID;delta:DecimalString;movementType:MovementType;productionOrderId:UUID|null;distributionId:UUID|null;actorId:UUID;movementAt:Instant},tx:Tx):Promise<Stock>; }
interface BlocksReader { activeByLots(ids:UUID[],opts?:ReadOptions):Promise<Block[]>; byIncident(id:UUID,opts?:ReadOptions):Promise<Block[]>; }
interface IncidentReader { find(id:UUID,opts?:ReadOptions):Promise<Incident|null>; byOriginLot(id:UUID,opts?:ReadOptions):Promise<Incident[]>; confirmedDossierVersion(id:UUID,opts?:ReadOptions):Promise<number|null>; }
interface IncidentWriter { lock(id:UUID,tx:Tx):Promise<Incident|null>; create(input:{originLotId:UUID;title:string;type:IncidentType;severity:Severity;detectedAt:Instant;actorId:UUID},tx:Tx):Promise<Incident>; markDossierPending(id:UUID,tx:Tx):Promise<void>; startAnalysis(id:UUID,tx:Tx):Promise<Incident>; close(id:UUID,input:{resolution:string;actorId:UUID},tx:Tx):Promise<Incident>; }
interface BlockWriter { createMany(incidentId:UUID,lotIds:UUID[],reason:string,actorId:UUID,tx:Tx):Promise<Block[]>; release(blockId:UUID,reason:string,actorId:UUID,tx:Tx):Promise<ReleaseResult>; }
interface QualityReader { inspection(id:UUID):Promise<Inspection|null>; inspectionsByIds(ids:UUID[]):Promise<Inspection[]>; summarizeLots(ids:UUID[]):Promise<LotQuality[]>; dossier(incidentId:UUID):Promise<DossierView>; }
interface TraceabilityReader { forward(lotId:UUID,maxDepth:number):Promise<TraceResult>; backward(lotId:UUID,maxDepth:number):Promise<TraceResult>; commonOrigins(input:CommonOriginsRequest):Promise<TraceResult>; paths(input:PathsRequest):Promise<TraceResult>; verifyDescendant(origin:UUID,target:UUID):Promise<'YES'|'NO'|'UNKNOWN'>; }
interface OutboxWriter { enqueue<K extends EventType>(event:Omit<EventEnvelope<K>,'sequence'|'occurredAt'>,tx:Tx):Promise<void>; }
interface EventHandler<K extends EventType> { apply(event:EventEnvelope<K>):Promise<void>; }
```
Actor/auth validation outside port and revalidate locks in service; reader findMany returns only found, caller checks completeness. I-1 also exposes catalog readers, idempotency orchestration and lock helpers internally. `verifyDescendant` depth max20; YES if positive path verified, NO only complete negative, UNKNOWN on partial/timeout/graph pending; caller maps UNKNOWN to 503. LotWriter is internal I-1 (create new lot in same tx as stock). Outbox enqueue last after all business locks; eventId generated stable; worker handles ACK and version state, not external calls inside SQL tx. `confirmedDossierVersion` derive completed creation/update payload nextVersion ordered (creation version 1); lock incident when changes/ACK. All read interfaces throw typed unavailable on source failure, never empty fallback. Impact consumes readers; no dependence of incidents on impact module, only TraceabilityReader. Contracts package compile check and shared enum/error constants; DTO runtime validators separate. Signatures are baseline; adding methods or changes requires coordination.

## 9. Ejemplos de solicitudes (datos ficticios, UUID simbólicos salvo clave)
```json
{"code":"MP-001","productId":"UUID_PRODUCTO","supplierId":"UUID_PROVEEDOR","locationId":"UUID_UB","quantity":"100.000","receivedAt":"2026-11-25T15:00:00Z","expirationDate":null}
```
```json
{"name":"Elaboración de masa","locationId":"UUID_UB","producedAt":"2026-11-25T16:00:00Z","inputs":[{"lotId":"UUID_HARINA","quantity":"30.000"},{"lotId":"UUID_AZUCAR","quantity":"5.000"},{"lotId":"UUID_MANTEQUILLA","quantity":"2.000"}],"outputs":[{"code":"LP-001","productId":"UUID_MASA","quantity":"35.000","expirationDate":null}]}
```
```json
{"originLocationId":"UUID_UB","destinationLocationId":"UUID_CENTRO","distributedAt":"2026-11-25T18:00:00Z","items":[{"lotId":"UUID_PAN","quantity":"40.000"}]}
```
```json
{"lotId":"UUID_MP","templateId":"UUID_TPL","templateVersion":1,"inspectedAt":"2026-11-25T19:00:00Z","parameters":{"humedad":"16.5","color":"BLANCO","impurezas":true,"empaque":"INTEGRO"},"result":"NO_CONFORME","findings":[{"type":"IMPUREZAS","parameter":"impurezas","description":"Hallazgo ficticio","severity":"ALTA"}],"evidence":[]}
```
```json
{"originLotId":"UUID_MP","title":"Impurezas en harina","type":"CALIDAD","severity":"ALTA","detectedAt":"2026-11-25T19:10:00Z","description":"Investigación ficticia","inspectionIds":["UUID_INS"],"findings":[],"evidence":[]}
```
PATCH dossier: `{"expectedVersion":1,"notes":"Se revisaron los lotes derivados","inspectionIds":["UUID_INS"]}`; respuesta `{"data":{"incidentId":"UUID_INC","currentVersion":1,"expectedVersion":2,"dossierStatus":"PENDIENTE"}}`. Bloqueo `{"lotIds":["UUID_MP","UUID_PAN"],"reason":"Dependencia potencial comprobada"}`. Cierre `{"resolution":"Evaluación documentada"}`. Liberación `{"reason":"Revisión concluida"}`. Common `{"lotIds":["UUID_PAN","UUID_GALLETAS"],"maxDepth":10}`; paths `{"sourceLotId":"UUID_MP","targetLotId":"UUID_PAN","mode":"SHORTEST","maxDepth":10,"maxPaths":50}`. Los ejemplos solo explican forma; pruebas usan fixture UUID válidos de DATA_MODEL. Prohibido hardcodear respuestas de demo en servicios reales.
