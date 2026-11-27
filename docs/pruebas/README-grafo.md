# Reproducción de la evidencia Neo4j aislada

Requiere Node.js 22, `npm ci`, Neo4j 5.26 Community **de pruebas** con scripts `database/graph/apply-schema.mjs` aplicados. No ejecutar sobre datos reales: la prueba genera UUID nuevos y borra solo esos nodos en `finally`. Usar el perfil Compose aislado descrito en `docker-compose.test.yml`, nunca el entorno normal.

Desde la raíz, definir `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` y opcionalmente `NEO4J_DATABASE=neo4j`. Para actualizar el JSON, definir `TRACECHAIN_EVIDENCE_PATH=docs/pruebas/graph-projection-actual.json` (ruta absoluta si se ejecuta dentro de Docker). Ejecutar:

```sh
node --experimental-strip-types --test tests/integration/canonical-graph.integration.mts
node --experimental-strip-types --test tests/integration/graph-projection.integration.mts
```

El primer test imprime `GRAPH_PROJECTION_ACTUAL=...` y, si se indica la ruta, guarda el mismo objeto. El JSON muestra valores observados sin UUID efímeros y declara expresamente que no se ejercitaron SQL, Mongo ni HTTP. No usar las duraciones del runner como benchmark. Antes de afirmar resultados del escenario canónico integrado, generar entidades por los servicios SQL/Mongo oficiales y verificar los tres motores y la API. QE-01..05 exigen además oráculo de equivalencia y el protocolo completo de `PROJECT.md` §8.
