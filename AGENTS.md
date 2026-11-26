# AGENTS.md — instrucciones obligatorias v1.0

Aplica a todo TraceChain. Antes de modificar código, leer PROJECT.md, REQUIREMENTS.md, BUSINESS_RULES.md, DATA_MODEL.md, API_CONTRACT.md y PROGRESS.md. Estos seis junto a AGENTS.md son los siete documentos base. Inspeccionar rama, estado de Git, código y pruebas; no confiar solo en PROGRESS. Identificar integrante, tarea/Issue, RF/RNF/RN, dependencias y archivos permitidos. Si hay contradicción, bloquear cambio afectado y comunicarlo; no inventar decisiones ni reemplazar silenciosamente la especificación. Si no hay rol asignado, solicitarlo antes de editar. No pedir autorización para cada detalle menor coherente con tarea, sí para cambios de alcance/contrato/arquitectura.

## 1. Reglas AI-01..20
| ID | Obligación |
|---|---|
| AI-01 | Leer los siete documentos e inspeccionar repositorio. |
| AI-02 | Respetar responsabilidad del integrante. |
| AI-03 | No modificar contratos compartidos unilateralmente. |
| AI-04 | No agregar tablas, colecciones, tipos de nodo/relación sin aprobación (schema_migrations ya autorizado). |
| AI-05 | No agregar dependencias fuera del stack sin acuerdo. |
| AI-06 | No reemplazar motores. |
| AI-07 | No ampliar MVP. |
| AI-08 | No omitir validaciones para demo. |
| AI-09 | No editar migraciones aplicadas; nueva versión. |
| AI-10 | No duplicar servicios de otros módulos. |
| AI-11 | No modificar/borrar trabajo ajeno sin coordinación. |
| AI-12 | No desactivar pruebas para ocultar errores. |
| AI-13 | No inventar resultados experimentales. |
| AI-14 | Documentar decisiones, RF/RN y pruebas. |
| AI-15 | Informar inconsistencias antes de resolverlas. |
| AI-16 | No exponer secretos ni datos personales reales. |
| AI-17 | Reutilizar códigos oficiales de API. |
| AI-18 | Ejecutar verificaciones relevantes y reportar resultados reales. |
| AI-19 | Mantener DTO, tipos, eventos e interfaces compatibles. |
| AI-20 | Obtener acuerdo antes de cambios arquitectónicos. |

## 2. Límites y convenciones
Controller delgado → service (reglas) → repository (consultas) → driver. SQL parametrizado, Cypher parametrizado, filtros Mongo construidos con allowlist; no consultas/credenciales desde frontend. PostgreSQL autoridad, Mongo documentos, Neo proyección. No transacción distribuida. Stock, movimientos, idempotencia y outbox en misma transacción SQL; compartir PoolClient, locks ordenados y revalidación. No float para inventario. UUID v4 internos, códigos inmutables, cantidades API strings con tres decimales, UTC y fecha civil de negocio según DATA_MODEL. Recorrer solo Lote→Proceso→Lote; niveles mínimos, deduplicar, distinguir vacío/parcial/no disponible. Cierre no desbloquea. No ocultar fallos ni afirmar contaminación. No exponer password_hash, JWT, URI/credenciales en logs/respuestas. Usar datos ficticios.

TypeScript strict, evitar any (excepción justificada), carpetas/archivos kebab-case, clases/interfaces PascalCase, variables camelCase, constantes UPPER_SNAKE_CASE, DB español snake_case, API inglés camelCase (enums oficiales en español y claves dinámicas intactas), etiquetas Neo PascalCase y relaciones UPPER_SNAKE_CASE. UI y mensajes español. ESLint/Prettier, lockfile único raíz, módulos y componentes reutilizables. No mocks activos en aplicación integrada. No cambios destructivos en datos, git reset --hard, force push o limpieza masiva sin autorización. Trabajar en entorno de pruebas aislado. No declarar tests exitosos si no se ejecutaron.

## 3. Propiedad de rutas
| Área | Responsable |
|---|---|
| database/relational/**; backend/src/database/postgres/** | I-1 |
| backend/src/modules/{auth,users,suppliers,products,locations,lots,inventory,production,distribution,dashboard,system}/** | I-1 |
| backend/src/integration/outbox/**; config, common, app.module.ts, main.ts | I-1 |
| docker-compose.yml, .env.example, scripts de infraestructura, package.json raíz, lockfile, CI | I-1 coordina |
| frontend features auth/suppliers/products/locations/inventory/production/distribution y rutas correspondientes | I-1 |
| database/document/**; backend/src/database/mongodb/** | I-2 |
| backend/src/modules/{inspection-templates,inspections,quality,incidents,lot-blocks}/** | I-2 (SQL repositorios I-1) |
| backend/src/integration/handlers/mongodb/**; frontend features inspections/incidents salvo impacto | I-2 |
| PROJECT, AGENTS, REQUIREMENTS, BUSINESS_RULES y docs/ consolidación | I-2 coordina; autores de módulos aportan |
| database/graph/**; backend/src/database/neo4j/** | I-3 |
| backend/src/modules/{traceability,impact}/**; handlers/neo4j/** | I-3 |
| frontend features dashboard/traceability, ruta incidents/:id/impact, components, layouts, globals.css | I-3 |
| packages/contracts, integration/event-contracts, integration/read-models, DATA_MODEL, API_CONTRACT, tests/fixtures | Equipo |
| PROGRESS.md | Cada integrante su sección; registro compartido de decisiones con aprobación |

Pruebas siguen propiedad de módulo; integración/E2E/benchmark compartidos. I-1 coordina cliente HTTP/auth y wiring global; I-3 coordina layout/componentes; los demás consumen interfaces. I-1 provee repositorios SQL de incidencia/bloqueo, I-2 orquesta caso de uso y endpoint, I-3 provee prueba de alcance y módulo impact. No importaciones circulares: interfaces/DI tokens exportados y dependencias unidireccionales; extraer lectores si es necesario. I-1 coordina registro de módulos/handlers globales en PR de integración. Cualquier modificación de carpeta ajena necesita revisión de su dueño.

## 4. Git y tareas
main estable, develop integración; feature/pg-*, feature/mongo-*, feature/graph-*, fix/*, docs/*, release/* temporal si necesario. Crear rama de tarea desde develop actualizado (git switch develop; git pull --ff-only origin develop; git switch -c feature/mongo-schema, por ejemplo). Revisar git status/diff, añadir archivos específicos, commit Conventional Commits (feat(mongo): add templates; fix(inventory): prevent negative stock; docs(api): clarify contract; test(graph), refactor, chore, ci, perf). Con cambios confirmados, git fetch origin; git merge origin/develop; resolver conflictos preservando trabajo ajeno; volver a probar. Push de rama y PR hacia develop; squash merge para funcionalidad, eliminar rama solo tras verificar integración. No push directo main/develop durante desarrollo normal. Release develop→main mediante PR y merge que preserve historial común, tag v1.0.0 después de aceptación. Configurar protecciones disponibles; si no disponibles, revisión manual equivalente.

GitHub Issues/Projects: Pendiente, Lista, En progreso, En revisión, En pruebas, Completada; bloqueado visible. Issue contiene ID, dueño, objetivo, RF/RN, archivos, dependencias, criterios de aceptación y pruebas. Un revisor humano distinto del autor para módulo propio; ambos otros integrantes para contrato/modelo compartido; eventos revisados por responsables de motores; infraestructura por I-1 y otro; alcance y release por los tres. No asumir revisión de IA como aprobación humana.

PR debe incluir: objetivo, Issue vinculada, cambios, RF/RN, comandos y resultados, contratos/migraciones tocados, evidencia, riesgos y pendientes. CI: npm ci, lint, typecheck, test, build, motores aislados, migraciones/seeds, test:integration. E2E antes de release; benchmark controlado separado de CI. No inventar workflows ya ejecutados.

## 5. Punto de control obligatorio
Antes de tarea: leer PROGRESS.md, comprobar estado real (git status, log, tests), seleccionar tarea READY autorizada. Actualizar estado IN_PROGRESS y rama en su sección. Después de cada sesión: actualizar tareas, RF/endpoints/artefactos afectados, pruebas reales (comando, fecha, éxito/fallo/no ejecutada, evidencia), bloqueos y siguiente acción; agregar entrada única al historial con fecha, I-n, rama y commit si existe. No borrar historia. Actualizar porcentajes solo desde tareas verificadas/integradas, no estimación; no contar código generado como verificado. Si una prueba falla, conservar fallo y siguiente tarea. Si cambio compartido, actualizar documentos afectados en PR aprobado; PROGRESS no redefine reglas. Resolver conflictos de PROGRESS conservando registros de ambos. Estado MERGED solo con evidencia de integración; Git/CI son fuente observada, PROGRESS refleja esa evidencia.

Definition of Done: RF/RN satisfechos, contrato respetado, entradas y permisos validados, transacciones y fallos cubiertos, regresiones probadas, lint/tipos/build aplicables, documentación actualizada, sin secretos, PR aprobado y merge confirmado. IMPLEMENTED no equivale a VERIFIED; VERIFIED no equivale a MERGED. Si no se puede ejecutar una prueba, registrar NOT_RUN y razón; no marcar VERIFIED. No realizar benchmark ficticio.

## 6. Prompts de rol (para inicializar agentes)
I-1: Actúa como desarrollador relacional de TraceChain: PostgreSQL, operaciones, autenticación, infraestructura, repositorios SQL de incidencias/bloqueos, outbox. Sigue los siete archivos y las interfaces; no implementes los motores de otros integrantes. Identifica tarea READY y devuelve plan antes de editar.

I-2: Actúa como desarrollador documental de TraceChain: MongoDB, calidad, validadores, plantillas, inspecciones, agregaciones, expedientes, flujo funcional de incidencias/bloqueos, handlers Mongo y documentación. Consume interfaces SQL y grafo autorizadas. No alteres esquemas ajenos. Sigue los siete archivos, selecciona tarea READY y registra punto de control.

I-3: Actúa como desarrollador de grafos de TraceChain: Neo4j, proyección, recorridos, visualización, impacto integrado y coordinación UX/UI. No modifiques inventario ni documentos directamente. Sigue los siete archivos y mantén contratos compartidos.
