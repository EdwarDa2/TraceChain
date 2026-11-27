# Entrega I-1 → I-2: puente mínimo de integración

Documento de coordinación (derivado, no normativo). No modifica contratos ni rutas de propiedad de `AGENTS.md` §3. I-1 conserva la infraestructura, el bootstrap y los módulos relacionales; I-2 aporta los adaptadores documentales y los módulos de calidad/incidencias/bloqueos.

## Qué necesita I-2 de I-1 (y en ese orden)

| Orden | Tarea | Archivo(s) que I-1 debe habilitar | Para qué lo necesita I-2 |
|---|---|---|---|
| 1 | BASE-01 | `package.json` raíz con workspaces, `backend/package.json`, `frontend/package.json`, lockfile, `tsconfig` strict, ESLint/Prettier | Convertir los 14 archivos `.mts` a `.ts`/`.tsx` y ejecutar lint/typecheck/build |
| 2 | BASE-02 | `docker-compose.yml` con servicio `mongodb:8.0.x`, `.env.example` con `MONGODB_URI` y `MONGODB_DATABASE=tracechain_quality`, volumen `mongodb_data` | Aplicar validadores, índices y semilla; ejecutar PM-01..23 |
| 3 | BASE-05 | `packages/contracts/**` con los tipos compartidos de `API_CONTRACT.md` §2/§7/§8 | Sustituir los tipos estructurales temporales de I-2 por imports oficiales |
| 4 | BASE-06 | `tests/fixtures/demo/**`, reloj inyectable y `expected-results.json` | Ejecutar inspecciones/incidencias del fixture canónico y DEMO-150 |
| 5 | Wiring | `backend/src/app.module.ts` (propiedad de I-1) | Registrar los módulos `InspectionTemplates`, `Inspections`, `Quality`, `Incidents`, `LotBlocks` y los handlers Mongo |

Variables mínimas para I-2: `MONGODB_URI`, `MONGODB_DATABASE`, `NODE_ENV`, `JWT_SECRET`, `BUSINESS_TIMEZONE=America/Mexico_City`, `OUTBOX_ENABLED`. Sin valores reales en Git (RNF-07).

## Lo que I-2 ya entregó en `develop`

| Artefacto | Puertos que expone | Prueba ejecutada |
|---|---|---|
| `database/document/validators/**`, `indexes/**`, `data/**` | Scripts `apply-validators.mjs`, `create-indexes.mongosh.js`, `seed-templates.mjs` | 309 verificaciones estáticas |
| `backend/src/modules/inspections/parameters.validator.mts` | `validateInspectionParameters`, `validateTemplate`, `compareDecimals` | 18/18 |
| `backend/src/modules/quality/quality-aggregations.mts` | `QualityReader`, `QualityReaderPorts` | 9/9 |
| `backend/src/modules/incidents/dossier.mts` | `DossierStore`, `DossierRepository`, `applyMongoEvent` | 14/14 |
| `backend/src/modules/incidents/incident-lifecycle.mts` | Transiciones y `puedeEditarExpediente` | 10/10 |
| `backend/src/modules/lot-blocks/block-service.mts` | `BlockStore`, `BlockVerification`, `IncidentSource` | 14/14 |
| `frontend/src/features/inspections/**`, `frontend/src/features/incidents/**` | Modelos de vista puros | 13/13 |

Total: **78/78** pruebas unitarias en `develop`.

## Adaptadores que I-2 añade en esta rama

`backend/src/database/mongodb/adapters.mts` implementa los puertos anteriores sobre un objeto `Db` inyectado, sin importar el driver en tiempo de ejecución: expone una interfaz estructural mínima (`MongoLikeDb`) que satisface `mongodb` 6.x. Así se puede probar hoy con un doble y conectar mañana pasando `client.db(process.env.MONGODB_DATABASE)`.

- `createMongoDossierStore(db)` → `DossierStore` (CAS por `_id`/`version`, replay por `ultimo_evento_id`).
- `createMongoQualityPorts(db)` → `QualityReaderPorts` (lecturas de `inspecciones_calidad` y armado de `DossierView`).
- Mapeadores explícitos camelCase ↔ snake_case español y `Date` ↔ ISO, sin exponer `_id`, `password_hash` ni credenciales.

## Dependencias que I-2 consume de otros roles

- De I-1: `IncidentReader`, `BlockReader`, repositorios SQL de incidencia/bloqueo, `TransactionManager`, `OutboxWriter`, auth/roles e idempotencia HTTP.
- De I-3: `TraceabilityReader.verifyDescendant` (para `BlockVerification`).

Hasta que existan, los puertos se inyectan en pruebas aisladas. **No hay mocks en aplicación integrada** (AI-12).

## Orden de verificación cuando exista infraestructura

```bash
node database/document/tests/static-check.mjs
# con MONGODB_URI del entorno:
node database/document/validators/apply-validators.mjs
mongosh "$MONGODB_URI" --file database/document/indexes/create-indexes.mongosh.js
node database/document/data/seed-templates.mjs
# luego, con dependencias instaladas:
npm run lint && npm run typecheck && npm run test && npm run build
# pruebas PM-01..23, TP-17, PI-08 y E2E en entorno aislado
```

Mientras no se ejecuten, esas suites permanecen `NOT_RUN` en `PROGRESS.md`. La conversión de `.mts` a `.ts` debe hacerse en el mismo PR en que I-1 habilite los `package.json`.
