import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import neo4j from 'neo4j-driver';

const MIGRATIONS = ['001_catalogs', '002_inventory', '003_production',
  '004_distribution', '005_incidents', '006_integration', '007_views_indexes', '008_operation_codes'];

/** UUID v4 determinista: mismo identificador en PostgreSQL y Neo4j. */
export function stableUuid(label, index) {
  const bytes = createHash('sha256').update(`${label}:${index}`).digest();
  const hex = bytes.toString('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const group = (from, to) => hex.slice(from, to).join('');
  return `${group(0, 8)}-${group(8, 12)}-${group(12, 16)}-${group(16, 20)}-${group(20, 32)}`;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function thousands(value) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(3, '0').slice(0, 3));
}

/** Topología determinista: grupos independientes, capas directed, reutilización de insumos. */
function plan({ lots, depth, seed, label, topology = 'balanced' }) {
  const rng = mulberry32(seed);
  const tag = label ?? String(lots);
  const uid = (kind, index) => stableUuid(`${tag}:${kind}`, index);
  const allowed = ['balanced', 'linear', 'branch', 'converge', 'independent'];
  if (!allowed.includes(topology)) throw new Error('VALIDATION_ERROR');
  const groups = topology === 'independent'
    ? Math.min(100, Math.max(1, Math.floor(lots / (depth + 1))))
    : Math.min(10, Math.max(1, Math.floor(lots / (depth + 1))));
  const layers = depth + 1;
  const weights = Array.from({ length: layers }, (_, index) => {
    if (topology === 'branch') return 2 ** index;
    if (topology === 'converge') return 2 ** (layers - 1 - index);
    return 1;
  });
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const layerSizesFor = (total) => {
    const sizes = weights.map((weight) => Math.max(1, Math.floor(total * weight / weightSum)));
    let extra = total - sizes.reduce((sum, value) => sum + value, 0);
    let cursor = 0;
    while (extra > 0) {
      sizes[cursor % layers] += 1;
      extra -= 1;
      cursor += 1;
    }
    return sizes;
  };
  const catalog = {
    suppliers: Array.from({ length: 8 }, (_, i) => ({
      id: uid('supplier', i), code: `PROV-${String(i + 1).padStart(3, '0')}`,
      name: `Proveedor ficticio ${i + 1}`,
    })),
    products: Array.from({ length: 15 }, (_, i) => ({
      id: uid('product', i), code: `PRD-${String(i + 1).padStart(3, '0')}`,
      name: `Producto ficticio ${i + 1}`,
      type: i < 5 ? 'MATERIA_PRIMA' : i < 10 ? 'INTERMEDIO' : 'TERMINADO',
      unit: 'KG',
    })),
    locations: Array.from({ length: 5 }, (_, i) => ({
      id: uid('location', i), code: i === 0 ? 'UB-001' : `SUC-0${i}`,
      name: i === 0 ? 'Planta ficticia' : `Sucursal ficticia ${i}`,
      type: i === 0 ? 'PLANTA_PRODUCCION' : 'SUCURSAL',
    })),
  };
  const operator = { id: uid('user', 0), name: 'Operador ficticio' };
  const perGroup = Math.floor(lots / groups);
  const remainder = lots % groups;
  const lotRows = [];
  const processRows = [];
  const consumptionRows = [];
  const resultRows = [];
  const distributionRows = [];
  const detailRows = [];
  let lotIndex = 0;
  let processIndex = 0;
  let distributionIndex = 0;
  const groupLayers = [];
  const start = Date.parse('2026-11-20T00:00:00Z');
  let minute = 0;
  const at = () => new Date(start + (minute += 1) * 60_000).toISOString();

  for (let group = 0; group < groups; group += 1) {
    const size = perGroup + (group < remainder ? 1 : 0);
    const layerSizes = layerSizesFor(size);
    const byLayer = [];
    for (let layer = 0; layer < layers; layer += 1) {
      const ids = [];
      for (let item = 0; item < layerSizes[layer]; item += 1) {
        const index = lotIndex++;
        const id = uid('lot', index);
        const product = catalog.products[(layer === 0 ? 0 : layer === layers - 1 ? 10 : 5) +
          (index % 5)];
        lotRows.push({
          id, code: `LOT-${String(index + 1).padStart(6, '0')}`,
          productId: product.id, supplierId: layer === 0
            ? catalog.suppliers[Math.floor(rng() * catalog.suppliers.length)].id : null,
          originType: layer === 0 ? 'RECEPCION' : 'PRODUCCION',
          initialQuantity: layer === 0 ? '1000.000' : '100.000', at: at(),
          layer, group,
        });
        ids.push(id);
      }
      byLayer.push(ids);
    }
    groupLayers.push(byLayer);
    for (let layer = 1; layer < layers; layer += 1) {
      const sources = byLayer[layer - 1];
      const targets = byLayer[layer];
      for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
        const processId = uid('process', processIndex);
        const inputCount = topology === 'balanced' || topology === 'converge' ? 2 : 1;
        const inputs = [...new Set(Array.from({ length: inputCount }, (_, offset) =>
          sources[(targetIndex + offset) % sources.length]))];
        const orderCode = `OP-${String(processIndex + 1).padStart(6, '0')}`;
        processRows.push({ id: processId, code: orderCode, name: `Proceso ${layer}`, at: at(), group });
        for (const [inputIndex, lotId] of inputs.entries()) {
          consumptionRows.push({
            id: uid('consumption', processIndex * 4 + inputIndex),
            orderId: processId, lotId, quantity: '5.000', unit: 'KG',
          });
        }
        resultRows.push({
          id: uid('result', processIndex), orderId: processId,
          lotId: targets[targetIndex], quantity: '100.000', unit: 'KG',
        });
        processIndex += 1;
      }
    }
    const finals = byLayer[layers - 1];
    for (let selected = 0; selected < Math.min(4, finals.length); selected += 1) {
      const distributionId = uid('distribution', distributionIndex);
      const destination = catalog.locations[1 + ((group + selected) % 4)];
      distributionRows.push({
        id: distributionId, code: `DIST-${String(distributionIndex + 1).padStart(6, '0')}`,
        originId: catalog.locations[0].id, destinationId: destination.id, at: at(), group,
      });
      detailRows.push({
        id: uid('detail', distributionIndex), distributionId,
        lotId: finals[selected], quantity: '1.000', unit: 'KG',
      });
      distributionIndex += 1;
    }
  }
  return {
    seed, lots, depth, groups, layers, catalog, operator,
    lotRows, processRows, consumptionRows, resultRows, distributionRows, detailRows,
    roots: groupLayers.flatMap((layersOfGroup) => layersOfGroup[0]),
    finals: groupLayers.flatMap((layersOfGroup) => layersOfGroup[layers - 1]),
    byLayer: groupLayers[0],
    pairIds: (() => {
      const firstGroup = groupLayers[0];
      const parentLayer = firstGroup[depth - 1];
      const childLayer = firstGroup[depth];
      return [parentLayer[0], childLayer[0]];
    })(),
    stats: {
      topology, groups, layers, lots: lotRows.length, processes: processRows.length,
      consumptions: consumptionRows.length, results: resultRows.length,
      distributions: distributionRows.length,
      maxDepthObserved: layers - 1,
      firstGroupLayerCounts: groupLayers[0].map((layer) => layer.length),
    },
  };
}

async function insertSql(pool, planData, label) {
  const uid = (kind, index) => stableUuid(`${label}:${kind}`, index);
  for (const version of MIGRATIONS) {
    await pool.query(await readFile(
      new URL(`../../../database/relational/schema/${version}.sql`, import.meta.url), 'utf8'));
  }
  const { catalog, operator } = planData;
  await pool.query(`INSERT INTO usuarios(id,nombre,correo,password_hash,rol)
    VALUES($1,$2,$3,'hash-solo-benchmark','OPERADOR')`,
  [operator.id, operator.name, 'benchmark@example.invalid']);
  for (const batch of chunk(catalog.suppliers, 500)) {
    await pool.query(`INSERT INTO proveedores(id,codigo,nombre) VALUES ${batch.map((_, i) =>
      `($${i * 3 + 1},$${i * 3 + 2},$${i * 3 + 3})`).join(',')}`,
    batch.flatMap((item) => [item.id, item.code, item.name]));
  }
  for (const batch of chunk(catalog.products, 500)) {
    await pool.query(`INSERT INTO productos(id,codigo,nombre,tipo,unidad_medida) VALUES ${batch.map((_, i) =>
      `($${i * 5 + 1},$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5})`).join(',')}`,
    batch.flatMap((item) => [item.id, item.code, item.name, item.type, item.unit]));
  }
  for (const batch of chunk(catalog.locations, 500)) {
    await pool.query(`INSERT INTO ubicaciones(id,codigo,nombre,tipo) VALUES ${batch.map((_, i) =>
      `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`).join(',')}`,
    batch.flatMap((item) => [item.id, item.code, item.name, item.type]));
  }
  for (const batch of chunk(planData.lotRows, 250)) {
    await pool.query(`INSERT INTO lotes
      (id,codigo,producto_id,proveedor_id,tipo_origen,cantidad_inicial,fecha_origen,registrado_por)
      VALUES ${batch.map((_, i) => `($${i * 8 + 1},$${i * 8 + 2},$${i * 8 + 3},$${i * 8 + 4},
        $${i * 8 + 5},$${i * 8 + 6},$${i * 8 + 7},$${i * 8 + 8})`).join(',')}`,
    batch.flatMap((item) => [item.id, item.code, item.productId, item.supplierId,
      item.originType, item.initialQuantity, item.at, operator.id]));
  }
  const outgoing = new Map();
  const distributed = new Map();
  for (const row of planData.consumptionRows) {
    outgoing.set(row.lotId, (outgoing.get(row.lotId) ?? 0) + 5);
  }
  for (const row of planData.detailRows) {
    distributed.set(row.lotId, (distributed.get(row.lotId) ?? 0) + 1);
  }
  const stockRows = planData.lotRows.map((lot) => ({
    id: uid(`stock:${lot.id}`, 0), lotId: lot.id,
    locationId: catalog.locations[0].id,
    quantity: String(Number(lot.initialQuantity) - (outgoing.get(lot.id) ?? 0) -
      (distributed.get(lot.id) ?? 0)),
  }));
  for (const detail of planData.detailRows) {
    const distribution = planData.distributionRows.find((item) => item.id === detail.distributionId);
    stockRows.push({
      id: uid(`stock:${detail.id}`, 0), lotId: detail.lotId,
      locationId: distribution.destinationId, quantity: detail.quantity,
    });
  }
  for (const batch of chunk(stockRows, 250)) {
    await pool.query(`INSERT INTO existencias(id,lote_id,ubicacion_id,cantidad)
      VALUES ${batch.map((_, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`).join(',')}`,
    batch.flatMap((item) => [item.id, item.lotId, item.locationId, item.quantity]));
  }
  for (const batch of chunk(planData.processRows, 250)) {
    await pool.query(`INSERT INTO ordenes_produccion
      (id,codigo,nombre,ubicacion_id,fecha_produccion,usuario_id)
      VALUES ${batch.map((_, i) => `($${i * 6 + 1},$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6})`).join(',')}`,
    batch.flatMap((item) => [item.id, item.code, item.name,
      catalog.locations[0].id, item.at, operator.id]));
  }
  for (const batch of chunk(planData.consumptionRows, 250)) {
    await pool.query(`INSERT INTO consumos_produccion(id,orden_produccion_id,lote_id,cantidad)
      VALUES ${batch.map((_, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`).join(',')}`,
    batch.flatMap((item) => [item.id, item.orderId, item.lotId, item.quantity]));
  }
  for (const batch of chunk(planData.resultRows, 250)) {
    await pool.query(`INSERT INTO resultados_produccion(id,orden_produccion_id,lote_id,cantidad)
      VALUES ${batch.map((_, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`).join(',')}`,
    batch.flatMap((item) => [item.id, item.orderId, item.lotId, item.quantity]));
  }
  for (const batch of chunk(planData.distributionRows, 250)) {
    await pool.query(`INSERT INTO distribuciones
      (id,codigo,ubicacion_origen_id,ubicacion_destino_id,fecha_distribucion,usuario_id)
      VALUES ${batch.map((_, i) => `($${i * 6 + 1},$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6})`).join(',')}`,
    batch.flatMap((item) => [item.id, item.code, item.originId,
      item.destinationId, item.at, operator.id]));
  }
  for (const batch of chunk(planData.detailRows, 250)) {
    await pool.query(`INSERT INTO detalle_distribuciones(id,distribucion_id,lote_id,cantidad)
      VALUES ${batch.map((_, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`).join(',')}`,
    batch.flatMap((item) => [item.id, item.distributionId, item.lotId, item.quantity]));
  }
}

const stamp = (value) => neo4j.types.DateTime.fromStandardDate(new Date(value));

async function insertGraph(driver, database, planData) {
  const { catalog } = planData;
  const run = async (cypher, rows) => {
    for (const batch of chunk(rows, 500)) {
      await driver.executeQuery(cypher, { rows: batch }, { database });
    }
  };
  await run(`UNWIND $rows AS row MERGE (n:Proveedor {id:row.id})
    SET n.codigo=row.code, n.nombre=row.name, n.activo=true`,
  catalog.suppliers);
  await run(`UNWIND $rows AS row MERGE (n:Producto {id:row.id})
    SET n.codigo=row.code, n.nombre=row.name, n.tipo=row.type,
      n.unidad_medida=row.unit, n.activo=true`,
  catalog.products);
  await run(`UNWIND $rows AS row MERGE (n:Ubicacion {id:row.id})
    SET n.codigo=row.code, n.nombre=row.name, n.tipo=row.type, n.activo=true`,
  catalog.locations);
  await run(`UNWIND $rows AS row MERGE (n:Lote {id:row.id})
    SET n.codigo=row.code, n.tipo_origen=row.originType, n.fecha_origen=row.at`,
  planData.lotRows.map((lot) => ({ ...lot, at: stamp(lot.at) })));
  await run(`UNWIND $rows AS row MERGE (l:Lote {id:row.lotId})
    WITH l, row MATCH (s:Proveedor {id:row.supplierId})
    MERGE (s)-[r:SUMINISTRA {id:'SUMINISTRA:' + row.lotId}]->(l)
    SET r.fecha_recepcion=row.at`,
  planData.lotRows.filter((lot) => lot.supplierId)
    .map((lot) => ({ lotId: lot.id, supplierId: lot.supplierId, at: stamp(lot.at) })));
  await run(`UNWIND $rows AS row MATCH (l:Lote {id:row.lotId})
    MATCH (p:Producto {id:row.productId})
    MERGE (l)-[:CORRESPONDE_A {id:'CORRESPONDE_A:' + row.lotId}]->(p)`,
  planData.lotRows.map((lot) => ({ lotId: lot.id, productId: lot.productId })));
  await run(`UNWIND $rows AS row MERGE (n:Proceso {id:row.id})
    SET n.codigo=row.code, n.nombre=row.name, n.ubicacion_id=row.locationId,
      n.fecha_produccion=row.at`,
  planData.processRows.map((item) => ({ ...item,
    locationId: catalog.locations[0].id, at: stamp(item.at) })));
  await run(`UNWIND $rows AS row MATCH (l:Lote {id:row.lotId}), (p:Proceso {id:row.orderId})
    MERGE (l)-[r:UTILIZADO_EN {id:row.id}]->(p)
    SET r.cantidad_milesimas=row.quantity, r.unidad=row.unit`,
  planData.consumptionRows.map((item) => ({ ...item, quantity: neo4j.int(thousands(item.quantity)) })));
  await run(`UNWIND $rows AS row MATCH (p:Proceso {id:row.orderId}), (l:Lote {id:row.lotId})
    MERGE (p)-[r:GENERA {id:row.id}]->(l)
    SET r.cantidad_milesimas=row.quantity, r.unidad=row.unit`,
  planData.resultRows.map((item) => ({ ...item, quantity: neo4j.int(thousands(item.quantity)) })));
  await run(`UNWIND $rows AS row MERGE (n:Distribucion {id:row.id})
    SET n.codigo=row.code, n.fecha_distribucion=row.at`,
  planData.distributionRows.map((item) => ({ ...item, at: stamp(item.at) })));
  await run(`UNWIND $rows AS row MATCH (l:Lote {id:row.lotId}), (d:Distribucion {id:row.distributionId})
    MERGE (l)-[r:INCLUIDO_EN {id:row.id}]->(d)
    SET r.cantidad_milesimas=row.quantity, r.unidad=row.unit`,
  planData.detailRows.map((item) => ({ ...item, quantity: neo4j.int(thousands(item.quantity)) })));
  await run(`UNWIND $rows AS row MATCH (d:Distribucion {id:row.id}),
    (o:Ubicacion {id:row.originId}), (t:Ubicacion {id:row.destinationId})
    MERGE (d)-[:SALE_DE {id:'SALE_DE:' + row.id}]->(o)
    MERGE (d)-[:ENTREGADO_A {id:'ENTREGADO_A:' + row.id}]->(t)`,
  planData.distributionRows);
}

export async function loadCase({ pool, driver, database, lots, depth, seed = 42, label,
  topology = 'balanced' }) {
  const planData = plan({ lots, depth, seed, label, topology });
  await insertSql(pool, planData, label);
  await insertGraph(driver, database, planData);
  const ids = [...planData.catalog.suppliers, ...planData.catalog.products,
    ...planData.catalog.locations].map((item) => item.id)
    .concat(planData.lotRows.map((item) => item.id),
      planData.processRows.map((item) => item.id),
      planData.distributionRows.map((item) => item.id));
  const manifest = {
    case: label, seed, lots, depth, topology,
    stats: planData.stats,
    rootIds: planData.roots,
    finalIds: planData.finals,
    pairIds: planData.pairIds,
    targetId: planData.finals[0],
    independentId: planData.lotRows.find((lot) => lot.group !== planData.lotRows[0].group)?.id,
    ids,
    byLayer: planData.byLayer,
  };
  return { planData, manifest };
}

export async function unloadGraph(driver, database, ids) {
  await driver.executeQuery('MATCH (n) WHERE n.id IN $ids DETACH DELETE n',
    { ids }, { database });
}
