# Matriz RF/RN → pruebas — TEST-02 (preparación)

Documento de seguimiento, **no evidencia de prueba de motor**. Las pruebas unitarias listadas sí se ejecutaron; los casos PM/TP/PI/E2E siguen `NOT_RUN` hasta que exista MongoDB, NestJS y CI. Las fuentes normativas siguen siendo `REQUIREMENTS.md`, `BUSINESS_RULES.md` y `API_CONTRACT.md`.

## Cobertura preparada por I-2

| RF / RN | Artefacto | Prueba unitaria ejecutada | Prueba oficial pendiente |
|---|---|---|---|
| RF-16, RF-17, RN-52, RN-55, RN-115 | `backend/src/modules/inspections/parameters.validator.mts` | `parameters.validator.spec.mts` — 18/18 | PM-05, PM-06, PM-23 |
| RF-19, RN-127, QM-05..08 | `backend/src/modules/quality/quality-aggregations.mts` | `quality-aggregations.spec.mts` — 9/9 | PM-17, PM-18 |
| RF-20, RF-22, RF-34, RN-63, RN-116 | `backend/src/modules/incidents/dossier.mts` | `dossier.spec.mts` — 14/14 | PM-12..16, PM-19/20 |
| RF-20..23, RN-64..68, RN-117 | `backend/src/modules/incidents/incident-lifecycle.mts` | `incident-lifecycle.spec.mts` — 10/10 | PM-19..22 |
| RF-31, RF-32, RN-87..96, RN-118 | `backend/src/modules/lot-blocks/block-service.mts` | `block-service.spec.mts` — 14/14 | TP-17, PI-08 |
| RF-16, RF-17 (UI), RNF-15 | `frontend/src/features/inspections/inspection-form.mts` | `inspection-form.spec.mts` — 6/6 | E2E-02 |
| RF-20..23, RF-31/32 (UI), RN-11 | `frontend/src/features/incidents/incident-view.mts` | `incident-view.spec.mts` — 7/7 | E2E-02, E2E-04 |
| RNF-10, DATA_MODEL §3 | `database/document/**` | `static-check.mjs` — 309 verificaciones | PM-01, PM-02, PM-07, PM-11, PM-12 |

**Total ejecutado:** 78 pruebas unitarias + 309 verificaciones estáticas, 2026-11-26.

## Comandos y resultados reales

```bash
node database/document/tests/static-check.mjs
# OK: 309 verificaciones estáticas superadas
# PM-01..23 siguen NOT_RUN: requieren MongoDB real (BASE-02)

node --experimental-strip-types --test \
  backend/src/modules/inspections/parameters.validator.spec.mts \
  backend/src/modules/quality/quality-aggregations.spec.mts \
  backend/src/modules/incidents/dossier.spec.mts \
  backend/src/modules/incidents/incident-lifecycle.spec.mts \
  backend/src/modules/lot-blocks/block-service.spec.mts \
  frontend/src/features/inspections/inspection-form.spec.mts \
  frontend/src/features/incidents/incident-view.spec.mts
# tests 78 / pass 78 / fail 0
```

## Pendiente (NOT_RUN, con motivo)

- **PM-01..23:** sin instancia MongoDB aislada ni scripts `db:seed` (BASE-01/02).
- **TP-17, PI-08:** requieren repositorios SQL de I-1 y `verifyDescendant` de I-3 reales.
- **E2E-01..05:** sin aplicación NestJS/Next.js desplegada.
- **Lint, typecheck, build:** sin `package.json` funcional ni dependencias instaladas.
- **QE-01..05, DA-01..08:** sin motores ni datasets cargados; no se reportan resultados ni se afirma superioridad de Neo4j.

## Nota de alcance

Las pruebas unitarias cubren reglas puras y no sustituyen la validación contra motores reales, la idempotencia HTTP ni la consistencia eventual. `IMPLEMENTED` no equivale a `VERIFIED`; esta matriz no cambia estados en `PROGRESS.md`.
