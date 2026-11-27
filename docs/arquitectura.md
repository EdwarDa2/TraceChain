# Arquitectura — resumen derivado (no normativo)

Fuente: `PROJECT.md` §4 y §5. No modifica decisiones: cualquier cambio arquitectónico requiere acuerdo (AI-20).

## Forma general

Monolito modular NestJS REST + Next.js App Router; el navegador solo habla HTTP JSON. Tres motores con responsabilidades distintas:

- **PostgreSQL 16:** autoridad operativa, incluidos estado oficial de incidencias y bloqueos.
- **MongoDB 8.0:** autoridad documental de plantillas, inspecciones y expedientes (`tracechain_quality`).
- **Neo4j 5.26 Community:** proyección reconstruible de genealogía; no almacena stock ni estados.

UUID compartidos entre motores; sin FK distribuidas ni transacción distribuida. Outbox persistente SQL con dos consumidores lógicos (Mongo y Neo4j), entrega al menos una vez y efectos idempotentes.

## Capas y propiedad

`controller delgado → service (reglas) → repository (consultas) → driver`. SQL y Cypher parametrizados; filtros Mongo por allowlist. I-1 posee PostgreSQL, operaciones, auth, infraestructura y outbox; I-2 posee MongoDB, calidad, incidencias, bloqueos y handlers Mongo; I-3 posee Neo4j, trazabilidad, impacto y componentes visuales. `packages/contracts` y `tests/fixtures` son del equipo. No importaciones circulares: interfaces y tokens DI exportados, dependencias unidireccionales.

## Disponibilidad

- Sin PostgreSQL: no hay autenticación ni operaciones protegidas.
- Sin MongoDB: las operaciones SQL continúan; las inspecciones no se guardan y el expediente puede quedar pendiente.
- Sin Neo4j: continúan las operaciones SQL; el análisis de grafos no está disponible.

Los resultados distinguen `COMPLETO`, `PARCIAL` y `NO_DISPONIBLE`. Un error nunca se convierte en cero ni en resultado completo (RN-124).

## Estado de implementación

Este resumen es documental. A la fecha del checkpoint no hay bootstrap funcional, `package.json` operativo ni motores corriendo; por tanto los diagramas y capacidades descritas son **planificación**, no software verificado.
