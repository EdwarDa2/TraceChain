# Fuente de verdad de TraceChain (derivado, no normativo)

Resumen de autoridad documental. **Los siete archivos de la raíz son la única línea base normativa.** Este documento es una guía de consulta: si contradice a la raíz, prevalece la raíz y se reporta la inconsistencia (AI-15).

| Documento | Autoridad | Versión vigente |
|---|---|---|
| `AGENTS.md` | Proceso, reglas AI-01..20, propiedad de rutas, Git y punto de control | v1.0 |
| `PROJECT.md` | Propósito, alcance, arquitectura, stack, hitos y metodología experimental | v1.1 |
| `REQUIREMENTS.md` | 35 RF, 20 RNF, matriz de trazabilidad y catálogos de pruebas | v1.1 |
| `BUSINESS_RULES.md` | Semántica RN-01..127 | v1.0 |
| `DATA_MODEL.md` | Persistencia, consultas, fixtures y protocolo de outbox | v1.1 |
| `API_CONTRACT.md` | Contratos REST exactos, DTO, eventos e interfaces internas | v1.0 |
| `PROGRESS.md` | Estado **observado**; nunca fuente de reglas | v1.1 |

La mezcla de versiones es deliberada, decisión D-002: AGENTS, BUSINESS_RULES y API_CONTRACT conservan v1.0; el prefijo `/api/v1`, `payloadVersion: 1` y las versiones de plantilla no cambian.

**Ante un conflicto:** bloquear el cambio afectado, comunicarlo y solicitar una decisión aprobada. No escoger arbitrariamente ni reemplazar silenciosamente la especificación (AI-03, AI-15, AI-20).

**Documentos derivados** (informativos): `docs/arquitectura.md`, `docs/decisiones-tecnologicas.md`, `docs/modelos/document/modelo-documental.md` y `docs/pruebas/matriz-trazabilidad.md`. Ninguno redefine RF, RN, esquemas ni contratos.

**Situación observada 2026-11-26:** el commit `130868b` de otro integrante incorporó los siete documentos a `develop`; los seis excepto `PROGRESS.md` son byte-idénticos a los de la rama documental. No se realizó merge, rebase ni borrado. Queda a decisión del equipo conservar ese commit o integrar únicamente los checkpoints y los documentos derivados de I-2.
