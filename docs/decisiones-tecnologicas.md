# Decisiones tecnológicas — resumen derivado (no normativo)

Fuente: `PROJECT.md` §5 y §9, `PROGRESS.md` §9. No sustituye a los documentos base.

## Stack aprobado

| Capa | Tecnología |
|---|---|
| Lenguaje | Node.js 22 LTS, npm 10.x, TypeScript 5.9 (strict) |
| Backend | NestJS 11, class-validator/transformer, `pg`, `mongodb` 6.x ≥6.10, `neo4j-driver` 6.x, Argon2id, decimal.js, Joi |
| Frontend | Next.js 16, React 19, Tailwind 4, TanStack Query/Table, React Hook Form, Zod, Cytoscape.js, Recharts |
| Pruebas | Jest, Supertest, Vitest, Testing Library, Playwright |
| Datos | PostgreSQL 16, MongoDB 8.0, Neo4j 5.26 Community |
| Infra | Docker Compose v2, npm workspaces, ESLint/Prettier |

## Decisiones de exclusión

No ORM (Prisma/TypeORM/Mongoose), no Redux/Zustand, no Axios, no microservicios, no brokers, no GDS/APOC obligatorios, no Nx/Turborepo, no aplicación móvil, no multiempresa ni bloqueo automático. Un solo lockfile en la raíz. Contratos TypeScript puros en `packages/contracts`, compilados antes de las apps y sin frameworks ni drivers.

Convenciones: carpetas kebab-case, clases/interfaces PascalCase, variables camelCase, constantes UPPER_SNAKE_CASE, DB snake_case en español, API camelCase en inglés, enums oficiales en español, etiquetas Neo PascalCase y relaciones UPPER_SNAKE_CASE.

## Registro de decisiones

- **D-001** (2026-11-25): línea base documental v1.0, consolida conversaciones previas y cierra detalles operativos.
- **D-002** (2026-11-25): revisión v1.1 solicitada por I-2; refuerza el papel analítico del grafo, incorpora DEMO-150 y DA-01..08 sin ampliar alcance; 40 → 42 tareas; AGENTS/BUSINESS_RULES/API_CONTRACT permanecen v1.0. Pendiente de ratificación por los tres integrantes.

## Observación técnica pendiente de aprobación (no es una decisión)

Los módulos de I-2 se escribieron con extensión `.mts` porque `backend/package.json` y `frontend/package.json` están vacíos y Node rechaza módulos `.ts` bajo un `package.json` inválido. `.mts` (ESM explícito) permite ejecutar las pruebas con `node --experimental-strip-types` sin instalar dependencias. Cuando BASE-01 cree los paquetes válidos, los archivos deben convertirse a `.ts`/`.tsx` y las firmas deben importarse desde `packages/contracts`. Reportado según AI-15; no se modificar archivos de infraestructura de I-1.
