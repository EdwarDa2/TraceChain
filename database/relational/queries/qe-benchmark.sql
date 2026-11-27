-- QE-01..05: consultas SQL equivalentes a las Cypher del benchmark.
-- El_depth se sustituye por un entero validado (3/8/15 en los casos base).
-- QE-01 descendientes (sustituir 3 por la profundidad del caso)
WITH RECURSIVE alcanzados AS (
  SELECT lote_hijo_id AS id, 1 AS depth, ARRAY[lote_padre_id, lote_hijo_id] AS seen
  FROM v_dependencias_productivas WHERE lote_padre_id = $1
  UNION ALL
  SELECT d.lote_hijo_id, a.depth + 1, a.seen || d.lote_hijo_id
  FROM alcanzados a JOIN v_dependencias_productivas d ON d.lote_padre_id = a.id
  WHERE a.depth < 3 AND NOT d.lote_hijo_id = ANY(a.seen)
) SELECT id AS lotId, min(depth)::int AS depth FROM alcanzados GROUP BY id ORDER BY id;

-- QE-02 antecedentes
WITH RECURSIVE alcanzados AS (
  SELECT lote_padre_id AS id, 1 AS depth, ARRAY[lote_hijo_id, lote_padre_id] AS seen
  FROM v_dependencias_productivas WHERE lote_hijo_id = $1
  UNION ALL
  SELECT d.lote_padre_id, a.depth + 1, a.seen || d.lote_padre_id
  FROM alcanzados a JOIN v_dependencias_productivas d ON d.lote_hijo_id = a.id
  WHERE a.depth < 3 AND NOT d.lote_padre_id = ANY(a.seen)
) SELECT id AS lotId, min(depth)::int AS depth FROM alcanzados GROUP BY id ORDER BY id;

-- QE-03, QE-04 y QE-05: versiones parametrizadas en tests/benchmark/lib/queries.mjs;
-- usan las mismas CTE con intersección, mínimo y destinos históricos.
