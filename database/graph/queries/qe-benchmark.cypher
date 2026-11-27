// QE-01..05: consultas Cypher equivalentes a las SQL del benchmark.
// El literal de profundidad se sustituye por 2*depth (6/16/30) tras validación.

// QE-01 descendientes
MATCH p=(o:Lote {id:$lotId})-[:UTILIZADO_EN|GENERA*2..6]->(d:Lote)
WHERE o <> d
RETURN d.id AS lotId, min(toInteger(length(p)/2)) AS depth ORDER BY lotId;

// QE-02 antecedentes
MATCH p=(o:Lote {id:$lotId})<-[:UTILIZADO_EN|GENERA*2..6]-(d:Lote)
WHERE o <> d
RETURN d.id AS lotId, min(toInteger(length(p)/2)) AS depth ORDER BY lotId;

// QE-03, QE-04 y QE-05: versiones parametrizadas en tests/benchmark/lib/queries.mjs;
// QE-05 compara destinos históricos, no existencias (PostgreSQL es autoridad de stock).
