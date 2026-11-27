import { createHash } from 'node:crypto';

/** Consultas equivalentes: la profundidad es número de transformaciones (dos aristas). */
const bounds = (depth) => {
  if (!Number.isInteger(depth) || depth < 1 || depth > 20) throw new Error('VALIDATION_ERROR');
  return depth * 2;
};

const ancestors = (depth) => `WITH RECURSIVE alcanzados AS (
  SELECT lote_padre_id AS id, 1 AS depth, ARRAY[lote_hijo_id, lote_padre_id] AS seen
  FROM v_dependencias_productivas WHERE lote_hijo_id = $1
  UNION ALL
  SELECT d.lote_padre_id, a.depth + 1, a.seen || d.lote_padre_id
  FROM alcanzados a JOIN v_dependencias_productivas d ON d.lote_hijo_id = a.id
  WHERE a.depth < ${depth} AND NOT d.lote_padre_id = ANY(a.seen)
) SELECT id AS lotId, min(depth)::int AS depth FROM alcanzados GROUP BY id ORDER BY id`;

const descendants = (depth) => `WITH RECURSIVE alcanzados AS (
  SELECT lote_hijo_id AS id, 1 AS depth, ARRAY[lote_padre_id, lote_hijo_id] AS seen
  FROM v_dependencias_productivas WHERE lote_padre_id = $1
  UNION ALL
  SELECT d.lote_hijo_id, a.depth + 1, a.seen || d.lote_hijo_id
  FROM alcanzados a JOIN v_dependencias_productivas d ON d.lote_padre_id = a.id
  WHERE a.depth < ${depth} AND NOT d.lote_hijo_id = ANY(a.seen)
) SELECT id AS lotId, min(depth)::int AS depth FROM alcanzados GROUP BY id ORDER BY id`;

export const SQL_QUERIES = {
  QE01: { sql: (depth) => descendants(depth), params: (m) => [m.rootIds[0]] },
  QE02: { sql: (depth) => ancestors(depth), params: (m) => [m.finalIds[0]] },
  QE03: {
    sql: (depth) => `WITH RECURSIVE a AS (
      SELECT lote_padre_id AS id, 1 AS depth, ARRAY[lote_hijo_id, lote_padre_id] AS seen
      FROM v_dependencias_productivas WHERE lote_hijo_id = $1
      UNION ALL
      SELECT d.lote_padre_id, a.depth + 1, a.seen || d.lote_padre_id
      FROM a JOIN v_dependencias_productivas d ON d.lote_hijo_id = a.id
      WHERE a.depth < ${depth} AND NOT d.lote_padre_id = ANY(a.seen)
    ), b AS (
      SELECT lote_padre_id AS id, 1 AS depth, ARRAY[lote_hijo_id, lote_padre_id] AS seen
      FROM v_dependencias_productivas WHERE lote_hijo_id = $2
      UNION ALL
      SELECT d.lote_padre_id, b.depth + 1, b.seen || d.lote_padre_id
      FROM b JOIN v_dependencias_productivas d ON d.lote_hijo_id = b.id
      WHERE b.depth < ${depth} AND NOT d.lote_padre_id = ANY(b.seen)
    ) SELECT DISTINCT a.id AS lotId FROM a JOIN b USING (id) ORDER BY a.id`,
    params: (m) => [m.pairIds[0], m.pairIds[1]],
  },
  QE04: {
    sql: (depth) => `WITH RECURSIVE alcanzados AS (
      SELECT lote_hijo_id AS id, 1 AS depth, ARRAY[lote_padre_id, lote_hijo_id] AS seen
      FROM v_dependencias_productivas WHERE lote_padre_id = $1
      UNION ALL
      SELECT d.lote_hijo_id, a.depth + 1, a.seen || d.lote_hijo_id
      FROM alcanzados a JOIN v_dependencias_productivas d ON d.lote_padre_id = a.id
      WHERE a.depth < ${depth} AND NOT d.lote_hijo_id = ANY(a.seen)
    ) SELECT min(depth)::int AS depth FROM alcanzados WHERE id = $2`,
    params: (m) => [m.rootIds[0], m.targetId],
  },
  QE05: {
    sql: (depth) => `WITH RECURSIVE alcanzados AS (
      SELECT $1::uuid AS id, 0 AS depth, ARRAY[$1::uuid] AS seen
      UNION ALL
      SELECT d.lote_hijo_id, a.depth + 1, a.seen || d.lote_hijo_id
      FROM alcanzados a JOIN v_dependencias_productivas d ON d.lote_padre_id = a.id
      WHERE a.depth < ${depth} AND NOT d.lote_hijo_id = ANY(a.seen)
    ) SELECT DISTINCT 'DEST' AS kind, r.id AS lotId, r.depth,
        d.ubicacion_destino_id AS locationId
      FROM alcanzados r JOIN detalle_distribuciones dd ON dd.lote_id = r.id
      JOIN distribuciones d ON d.id = dd.distribucion_id
      ORDER BY kind, lotId, locationId LIMIT 10001`,
    params: (m) => [m.rootIds[0]],
  },
};

const cypherReach = (depth, direction) => {
  const edges = bounds(depth);
  const pattern = direction === 'FORWARD'
    ? `(o:Lote {id:$lotId})-[:UTILIZADO_EN|GENERA*2..${edges}]->(d:Lote)`
    : `(o:Lote {id:$lotId})<-[:UTILIZADO_EN|GENERA*2..${edges}]-(d:Lote)`;
  return `MATCH p=${pattern} WHERE o <> d
    RETURN d.id AS lotId, min(toInteger(length(p)/2)) AS depth ORDER BY lotId`;
};

export const CYPHER_QUERIES = {
  QE01: { cypher: (depth) => cypherReach(depth, 'FORWARD'), params: (m) => ({ lotId: m.rootIds[0] }) },
  QE02: { cypher: (depth) => cypherReach(depth, 'BACKWARD'), params: (m) => ({ lotId: m.finalIds[0] }) },
  QE03: {
    cypher: (depth) => {
      const edges = bounds(depth);
      return `MATCH (a:Lote {id:$lotA})<-[:UTILIZADO_EN|GENERA*2..${edges}]-(c:Lote),
        (b:Lote {id:$lotB})<-[:UTILIZADO_EN|GENERA*2..${edges}]-(c:Lote)
        RETURN DISTINCT c.id AS lotId ORDER BY lotId`;
    },
    params: (m) => ({ lotA: m.pairIds[0], lotB: m.pairIds[1] }),
  },
  QE04: {
    cypher: (depth) => {
      const edges = bounds(depth);
      return `MATCH p=(o:Lote {id:$src})-[:UTILIZADO_EN|GENERA*2..${edges}]->(t:Lote {id:$target})
        RETURN min(toInteger(length(p)/2)) AS depth`;
    },
    params: (m) => ({ src: m.rootIds[0], target: m.targetId }),
  },
  QE05: {
    cypher: (depth) => {
      const edges = bounds(depth);
      return `MATCH p=(o:Lote {id:$root})-[:UTILIZADO_EN|GENERA*0..${edges}]->(d:Lote)
        WITH DISTINCT d, min(toInteger(length(p)/2)) AS depth
        MATCH (d)-[:INCLUIDO_EN]->(:Distribucion)-[:ENTREGADO_A]->(u:Ubicacion)
        RETURN d.id AS lotId, depth, u.id AS locationId ORDER BY lotId, locationId`;
    },
    params: (m) => ({ root: m.rootIds[0] }),
  },
};

/** Normalización para comparar resultados antes de cronometrar. */
export function fingerprint(rows, queryKey, motor) {
  let tuples;
  if (queryKey === 'QE03' || queryKey === 'QE04') {
    tuples = rows.map((row) => String(Object.values(row)[0]));
  } else if (queryKey === 'QE05') {
    tuples = rows.map((row) => {
      const values = motor === 'SQL'
        ? [row.lotid, row.depth, row.locationid]
        : [row.lotId, row.depth, row.locationId];
      return `DEST|${values.join('|')}`;
    });
  } else {
    tuples = rows.map((row) => `${row.lotid ?? row.lotId}:${row.depth}`);
  }
  return createHash('sha256').update(JSON.stringify(tuples.sort())).digest('hex');
}

export async function runSql(pool, queryKey, depth, manifest) {
  const query = SQL_QUERIES[queryKey];
  const result = await pool.query(query.sql(depth), query.params(manifest));
  return result.rows;
}

export async function runCypher(driver, database, queryKey, depth, manifest) {
  const query = CYPHER_QUERIES[queryKey];
  const result = await driver.executeQuery(query.cypher(depth), query.params(manifest), {
    database, timeout: 10_000,
  });
  return result.records.map((record) => Object.fromEntries(
    record.keys.map((key) => [key, record.get(key)?.toString?.() ?? record.get(key)])));
}
