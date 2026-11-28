# TraceChain

Plataforma académica de trazabilidad e impacto potencial en una red de lotes de una panificadora ficticia. Registra recepciones, producción multinivel y distribuciones; cruza inspecciones y expedientes de calidad; y permite investigar dependencias productivas, impactos y bloqueos manuales justificados.

**Una dependencia productiva no demuestra contaminación, causalidad ni aptitud sanitaria.**

## Arquitectura

- **PostgreSQL** es la autoridad operativa: catálogos, inventario, movimientos, órdenes, distribuciones, incidencias, bloqueos y outbox persistente.
- **MongoDB** guarda plantillas, inspecciones inmutables y expedientes versionados.
- **Neo4j** es una proyección reconstruible de la genealogía; no es autoridad.
- **NestJS** expone REST en `/api/v1`; **Next.js** consume solo HTTP JSON. Los consumidores del outbox aplican eventos de forma idempotente; no hay transacción distribuida.

## Requisitos

Node 22.22.x / npm 10.x, Docker y Docker Compose. No se necesita PostgreSQL local: las pruebas usan puertos aislados (PostgreSQL 55432, MongoDB 27017, Neo4j 7474/7687).

## Puesta en marcha

```bash
npm ci
cp .env.example .env                 # OUTBOX_ENABLED=true para proyectar eventos
npm run db:up
npm run db:migrate
node database/document/validators/apply-validators.mjs
node database/document/data/seed-templates.mjs
npm run dev                          # API en :3001 y frontend en :3000
```

Para **demostración** (opcional, entorno autorizado) cargar DEMO-150 con `npm run db:seed`; no es necesario para operar la aplicación. Las cuentas de demostración y la contraseña se entregan por entorno; los correos son ficticios (`*@example.invalid`). Nunca usar credenciales reales ni exponer secretos en el cliente.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run lint` / `typecheck` / `build` | Calidad estática y compilación de los tres workspaces |
| `npm run test` | Pruebas unitarias (incidencias, permisos y formularios de inspección) |
| `npm run test:integration` | Smoke de los tres motores, outbox, idempotencia, proyección, concurrencia y endpoints reales |
| `npm run test:e2e` | Suite Playwright sobre la UI con API real (requiere `npm run dev` y Chromium instalado) |
| `npm run benchmark` | Comparación SQL/Cypher QE-01..05 y perfiles adicionales; se ejecuta separado de CI |

Para E2E en un entorno aislado:

```bash
npx playwright install chromium
npm run dev                      # en otra terminal
npm run test:e2e
```

La suite usa una sesión compartida por worker porque el backend limita los inicios de sesión a 5 por minuto por IP.

## Flujo de uso

1. **Operador:** catálogos → recepción → producción → distribución. Cada mutación escribe el outbox.
2. **Analista:** inspecciones no conformes → incidencia con expediente → investigación → trazabilidad (adelante, atrás, comunes, caminos) → impacto integrado → bloqueo manual de descendientes verificados → resolución.
3. El analista retira bloqueos individualmente; cerrar una incidencia no libera bloqueos. Un resultado vacío válido, parcial y no disponible se distinguen en la interfaz.

## Evidencia y datos de demostración

- Escenario DEMO-150: 150 lotes, 60 órdenes, 40 distribuciones, 80 inspecciones y 10 incidencias; 279 nodos y 540 relaciones.
- Manifiesto y oráculo: `tests/fixtures/demo/ampliada/`.
- Resultados ejecutados: `docs/pruebas/`.
- Trazabilidad de RF/RN a evidencia: `docs/pruebas/acceptance-matrix.md`.
- API: `API_CONTRACT.md`. Datos: `DATA_MODEL.md`. Reglas: `BUSINESS_RULES.md`.

## Estado

Las 14 vistas están implementadas sobre API real. La aceptación final de DA-01..08 y el release `v1.0.0` requieren revisión humana; no se declaran completados hasta que exista esa evidencia.
