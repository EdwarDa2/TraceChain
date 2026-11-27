import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import neo4j, { type Driver } from 'neo4j-driver';
import type {
  Block, Dossier, DossierView, ImpactResult, Inspection, Lot, LotQuality,
  SourceStatus, Stock, Warning, Unit,
} from '@tracechain/contracts';
import { SqlService } from '../../database/postgres/sql.service';
import { MongoService } from '../../database/mongodb/mongo.service';
import { traverseLots } from '../../database/neo4j/traversal.mts';
import { productiveSubgraph } from '../../database/neo4j/subgraph.mts';
import { dossierDesdeDocumento } from '../../database/mongodb/adapters.mts';
import { validateEnv } from '../../config/env.validation.mts';

type Row = Record<string, unknown>;
type QueueState = { sequence: string; pending: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function date(value: unknown): string {
  return new Date(value as string).toISOString();
}
function nullableDate(value: unknown): string | null {
  return value === null || value === undefined ? null : date(value);
}
function quantity(value: unknown): string {
  return String(value ?? '0.000');
}
function source(sync: SourceStatus['sync'], pendingEvents: number | null,
  availability: SourceStatus['availability'] = 'AVAILABLE'): SourceStatus {
  return { availability, sync, checkedAt: new Date().toISOString(), pendingEvents };
}
function notice(code: Warning['code'], message: string): Warning {
  return { code, message };
}
function inspectionOf(row: Row): Inspection {
  const params = row.parametros as Record<string, unknown>;
  return {
    id: String(row._id), code: String(row.codigo), lotId: String(row.lote_id),
    productId: String(row.producto_id), templateId: String(row.plantilla_id),
    templateVersion: Number(row.plantilla_version), inspectorId: String(row.inspector_id),
    inspectedAt: date(row.fecha_inspeccion),
    parameters: Object.fromEntries(Object.entries(params).map(([key, value]) =>
      [key, value !== null && typeof value === 'object' && '_bsontype' in value
        ? String(value) : value])) as Inspection['parameters'],
    result: row.resultado as Inspection['result'],
    findings: (row.hallazgos as Row[]).map((item) => ({
      type: item.tipo as Inspection['findings'][number]['type'],
      parameter: item.parametro as string | null, description: String(item.descripcion),
      severity: item.severidad as Inspection['findings'][number]['severity'],
    })),
    notes: row.observaciones == null ? null : String(row.observaciones),
    evidence: (row.evidencias as Row[]).map((item) => ({
      type: item.tipo as Inspection['evidence'][number]['type'],
      reference: String(item.referencia),
      description: item.descripcion == null ? null : String(item.descripcion),
      registeredAt: date(item.fecha_registro),
    })),
    createdAt: date(row.created_at),
  };
}

@Injectable()
export class ImpactService implements OnModuleDestroy {
  private readonly config = validateEnv(process.env);
  private readonly graph: Driver = neo4j.driver(this.config.NEO4J_URI,
    neo4j.auth.basic(this.config.NEO4J_USER, this.config.NEO4J_PASSWORD));
  constructor(private readonly sql: SqlService, private readonly mongo: MongoService) {}

  private async queue(): Promise<QueueState> {
    const result = await this.sql.pool.query<{ sequence: string; pending: number }>(`SELECT
      COALESCE(max(secuencia),0)::text AS sequence,
      count(*) FILTER (WHERE estado <> 'COMPLETADO')::int AS pending
      FROM eventos_sincronizacion WHERE motor_destino='NEO4J'`);
    return result.rows[0]!;
  }

  async get(incidentId: string, maxDepth = 10): Promise<ImpactResult> {
    if (!UUID.test(incidentId) || !Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 20) {
      throw new Error('VALIDATION_ERROR');
    }
    const started = performance.now();
    const incidentRow = (await this.sql.pool.query<Row>(
      'SELECT * FROM incidencias WHERE id=$1', [incidentId])).rows[0];
    if (!incidentRow) throw new Error('RESOURCE_NOT_FOUND');
    const originId = String(incidentRow.lote_origen_id);
    const before = await this.queue();
    let traversal;
    try {
      traversal = await traverseLots(this.graph, this.config.NEO4J_DATABASE, originId, 'FORWARD', maxDepth);
    } catch (error) {
      if (error instanceof Error && error.message === 'GRAPH_INCONSISTENT') {
        throw new Error(before.pending ? 'GRAPH_SYNC_PENDING' : 'GRAPH_INCONSISTENT');
      }
      throw new Error('DATABASE_UNAVAILABLE');
    }
    const ids = [originId, ...traversal.lots.map((lot) => lot.lotId)];
    const depthById = new Map([[originId, 0], ...traversal.lots.map((lot) =>
      [lot.lotId, lot.depth] as [string, number])]);
    const [lots, stocks, movements, blocks] = await Promise.all([
      this.sql.pool.query<Row>(`SELECT l.*,p.nombre AS nombre_producto,p.tipo AS tipo_producto,
        p.unidad_medida FROM lotes l JOIN productos p ON p.id=l.producto_id
        WHERE l.id=ANY($1)`, [ids]),
      this.sql.pool.query<Row>(`SELECT e.lote_id,e.ubicacion_id,e.cantidad,e.updated_at,
        u.nombre AS nombre_ubicacion,l.codigo AS codigo_lote,l.producto_id,
        p.nombre AS nombre_producto,p.unidad_medida,l.fecha_caducidad,
        EXISTS(SELECT 1 FROM bloqueos_lotes b WHERE b.lote_id=e.lote_id AND b.activo) AS bloqueado
        FROM existencias e JOIN lotes l ON l.id=e.lote_id
        JOIN productos p ON p.id=l.producto_id JOIN ubicaciones u ON u.id=e.ubicacion_id
        WHERE e.lote_id=ANY($1) ORDER BY e.lote_id,e.ubicacion_id LIMIT 10001`, [ids]),
      this.sql.pool.query<Row>(`SELECT d.id AS distribucion_id,d.codigo AS codigo_distribucion,
        dd.lote_id,d.ubicacion_destino_id,u.nombre AS nombre_ubicacion,
        d.fecha_distribucion,dd.cantidad,p.unidad_medida
        FROM detalle_distribuciones dd JOIN distribuciones d ON d.id=dd.distribucion_id
        JOIN ubicaciones u ON u.id=d.ubicacion_destino_id
        JOIN lotes l ON l.id=dd.lote_id JOIN productos p ON p.id=l.producto_id
        WHERE dd.lote_id=ANY($1) ORDER BY d.fecha_distribucion,d.id,dd.lote_id LIMIT 10001`, [ids]),
      this.sql.pool.query<Row>(`SELECT * FROM bloqueos_lotes WHERE lote_id=ANY($1) AND activo=true
        ORDER BY lote_id,id LIMIT 10001`, [ids]),
    ]);
    if (lots.rows.length !== ids.length) throw new Error('GRAPH_INCONSISTENT');
    const sqlLots = new Map(lots.rows.map((row) => [String(row.id), row]));
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: this.config.BUSINESS_TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const blocked = new Set(blocks.rows.map((row) => String(row.lote_id)));
    if (blocks.rows.length > 10_000) {
      const allBlocked = await this.sql.pool.query<{ lote_id: string }>(
        'SELECT DISTINCT lote_id FROM bloqueos_lotes WHERE lote_id=ANY($1) AND activo=true',
        [ids]);
      for (const row of allBlocked.rows) blocked.add(row.lote_id);
    }
    const isExpired = (row: Row) => row.fecha_caducidad != null &&
      (row.fecha_caducidad instanceof Date
        ? row.fecha_caducidad.toISOString().slice(0, 10)
        : String(row.fecha_caducidad).slice(0, 10)) < today;
    const stockRows: Stock[] = stocks.rows.slice(0, 10_000).map((row) => ({
      lotId: String(row.lote_id), lotCode: String(row.codigo_lote),
      productId: String(row.producto_id), productName: String(row.nombre_producto),
      locationId: String(row.ubicacion_id), locationName: String(row.nombre_ubicacion),
      physicalQuantity: quantity(row.cantidad),
      usableQuantity: row.bloqueado === true || isExpired(row) ? '0.000' : quantity(row.cantidad),
      unit: row.unidad_medida as Unit, blocked: row.bloqueado === true,
      expired: isExpired(row), updatedAt: date(row.updated_at),
    }));
    const quantities = new Map<string, { physical: bigint; usable: bigint }>();
    for (const item of stockRows) {
      const current = quantities.get(item.lotId) ?? { physical: 0n, usable: 0n };
      current.physical += BigInt(item.physicalQuantity.replace('.', ''));
      current.usable += BigInt(item.usableQuantity.replace('.', ''));
      quantities.set(item.lotId, current);
    }
    const fmt = (value: bigint) => {
      const text = value.toString().padStart(4, '0');
      return `${text.slice(0, -3)}.${text.slice(-3)}`;
    };
    const stockTruncated = stocks.rows.length > 10_000;
    const destTruncated = movements.rows.length > 10_000;
    const blocksTruncated = blocks.rows.length > 10_000;
    if (stockTruncated) {
      const totals = await this.sql.pool.query<{ lotId: string; physical: string; usable: string }>(
        `SELECT e.lote_id AS "lotId", sum(e.cantidad)::text AS physical,
          sum(CASE WHEN l.fecha_caducidad < $2::date OR EXISTS (
            SELECT 1 FROM bloqueos_lotes b WHERE b.lote_id=e.lote_id AND b.activo
          ) THEN 0 ELSE e.cantidad END)::text AS usable
          FROM existencias e JOIN lotes l ON l.id=e.lote_id
          WHERE e.lote_id=ANY($1) GROUP BY e.lote_id`, [ids, today]);
      for (const row of totals.rows) {
        quantities.set(row.lotId, {
          physical: BigInt(row.physical.replace('.', '')),
          usable: BigInt(row.usable.replace('.', '')),
        });
      }
    }
    const affectedLots: ImpactResult['affectedLots'] = ids.map((id): ImpactResult['affectedLots'][number] => {
      const row = sqlLots.get(id)!;
      const depth = depthById.get(id)!;
      const totals = quantities.get(id) ?? { physical: 0n, usable: 0n };
      return { lotId: id, code: String(row.codigo), productId: String(row.producto_id),
        productName: String(row.nombre_producto), classification: depth === 0 ? 'ORIGEN'
          : depth === 1 ? 'DIRECTO' : 'INDIRECTO', depth, unit: row.unidad_medida as Unit,
        physicalQuantity: fmt(totals.physical), usableQuantity: fmt(totals.usable),
        blocked: blocked.has(id) };
    }).sort((a, b) => a.depth - b.depth || a.code.localeCompare(b.code) ||
      a.lotId.localeCompare(b.lotId));
    const destinations = movements.rows.slice(0, 10_000).map((row) => ({
      distributionId: String(row.distribucion_id),
      distributionCode: String(row.codigo_distribucion), lotId: String(row.lote_id),
      locationId: String(row.ubicacion_destino_id), locationName: String(row.nombre_ubicacion),
      distributedAt: date(row.fecha_distribucion), transferredQuantity: quantity(row.cantidad),
      unit: row.unidad_medida as Unit,
    }));
    const activeBlocks: Block[] = blocks.rows.slice(0, 10_000).map((row) => ({
      id: String(row.id), lotId: String(row.lote_id), incidentId: String(row.incidencia_id),
      reason: String(row.motivo), blockedBy: String(row.bloqueado_por),
      blockedAt: date(row.fecha_bloqueo), active: true,
      releasedBy: null, releasedAt: null, releaseReason: null,
    }));
    const warnings: Warning[] = traversal.warnings.map((code) =>
      notice(code, 'El recorrido fue limitado; el alcance puede ser mayor.'));
    let mongoSource = source('SYNCHRONIZED', 0);
    let quality: ImpactResult['quality'];
    try {
      const inspectionCounts = await this.mongo.db.collection<Row>('inspecciones_calidad')
        .aggregate<{ _id: string; total: number; conforming: number; nonConforming: number;
          latestInspectionId: string }>([
          { $match: { lote_id: { $in: ids } } },
          { $sort: { fecha_inspeccion: -1, _id: -1 } },
          { $group: { _id: '$lote_id', total: { $sum: 1 },
            conforming: { $sum: { $cond: [{ $eq: ['$resultado', 'CONFORME'] }, 1, 0] } },
            nonConforming: { $sum: { $cond: [{ $eq: ['$resultado', 'NO_CONFORME'] }, 1, 0] } },
            latestInspectionId: { $first: '$_id' } } },
        ]).toArray();
      const countsByLot = new Map(inspectionCounts.map((row) => [row._id, row]));
      const dossierDoc = await this.mongo.db.collection<Row>('expedientes_incidencias')
        .findOne({ incidencia_id: incidentId });
      const dossier: Dossier | null = dossierDoc === null ? null : (() => {
        const stored = dossierDesdeDocumento(dossierDoc as Record<string, unknown>);
        return {
          id: stored.id, incidentId: stored.incidentId, description: stored.description,
          inspectionIds: stored.inspectionIds, findings: stored.findings,
          evidence: stored.evidence, notes: stored.notes,
          detailedResolution: stored.detailedResolution, version: stored.version,
          createdAt: stored.createdAt, updatedAt: stored.updatedAt,
        };
      })();
      const dossierInspections = dossier
        ? await this.mongo.db.collection<Row & { _id: string }>('inspecciones_calidad')
          .find({ _id: { $in: dossier.inspectionIds } }).toArray() : [];
      const partialDossier = String(incidentRow.estado_expediente) !== 'SINCRONIZADO' ||
        !dossier || dossierInspections.length !== dossier.inspectionIds.length;
      const dossierView: DossierView = {
        dossierStatus: incidentRow.estado_expediente as DossierView['dossierStatus'],
        status: partialDossier ? 'PARCIAL' : 'COMPLETO',
        dossier, inspections: dossier ? dossierInspections.map(inspectionOf) : null,
        warnings: partialDossier ? [notice('DOCUMENT_PENDING',
          'El expediente aún no está completamente sincronizado.')] : [],
      };
      const byLot: LotQuality[] = ids.map((id) => {
        const count = countsByLot.get(id);
        return { lotId: id, totalInspections: count?.total ?? 0,
          conforming: count?.conforming ?? 0,
          nonConforming: count?.nonConforming ?? 0,
          latestInspectionId: count?.latestInspectionId ?? null };
      });
      quality = { status: partialDossier ? 'PARCIAL' : 'COMPLETO',
        data: { dossier: dossierView, byLot }, warnings: dossierView.warnings };
      if (partialDossier) {
        warnings.push(...dossierView.warnings);
        mongoSource = source('PENDING', null);
      }
    } catch {
      const warning = notice('QUALITY_UNAVAILABLE', 'La información documental no está disponible.');
      quality = { status: 'NO_DISPONIBLE', data: null, warnings: [warning] };
      warnings.push(warning);
      mongoSource = source('ERROR', null, 'UNAVAILABLE');
    }
    let visual;
    try {
      visual = await productiveSubgraph(this.graph, this.config.NEO4J_DATABASE,
        [originId], traversal.lots);
    } catch (error) {
      if (error instanceof Error && error.message === 'GRAPH_INCONSISTENT') {
        throw new Error(before.pending ? 'GRAPH_SYNC_PENDING' : 'GRAPH_INCONSISTENT');
      }
      throw new Error('DATABASE_UNAVAILABLE');
    }
    const after = await this.queue();
    const destinationCount = destTruncated
      ? Number((await this.sql.pool.query<{ total: string }>(`SELECT count(DISTINCT d.ubicacion_destino_id)::text AS total
          FROM detalle_distribuciones dd JOIN distribuciones d ON d.id=dd.distribucion_id
          WHERE dd.lote_id=ANY($1)`, [ids])).rows[0]!.total)
      : new Set(destinations.map((item) => item.locationId)).size;
    if (before.pending || after.pending) warnings.push(notice('GRAPH_PENDING',
      'La proyección del grafo tiene eventos pendientes.'));
    if (before.sequence !== after.sequence) warnings.push(notice('CONCURRENT_CHANGES',
      'Se detectaron operaciones durante la lectura.'));
    const details = (truncated: boolean) => truncated
      ? [notice('DETAIL_LIMIT', 'Se alcanzó el límite de detalle; consulte el listado paginado.')] : [];
    for (const truncated of [stockTruncated, destTruncated, blocksTruncated]) {
      if (truncated) warnings.push(...details(true));
    }
    const origin = sqlLots.get(originId)!;
    const originTotals = quantities.get(originId) ?? { physical: 0n, usable: 0n };
    const incident: ImpactResult['incident'] = {
      id: String(incidentRow.id), code: String(incidentRow.codigo),
      originLotId: originId, title: String(incidentRow.titulo),
      type: incidentRow.tipo as ImpactResult['incident']['type'],
      severity: incidentRow.severidad as ImpactResult['incident']['severity'],
      status: incidentRow.estado as ImpactResult['incident']['status'],
      dossierStatus: incidentRow.estado_expediente as ImpactResult['incident']['dossierStatus'],
      reportedBy: String(incidentRow.reportado_por), detectedAt: date(incidentRow.fecha_deteccion),
      createdAt: date(incidentRow.created_at), updatedAt: date(incidentRow.updated_at),
      closedAt: nullableDate(incidentRow.fecha_cierre),
      closedBy: incidentRow.cerrado_por == null ? null : String(incidentRow.cerrado_por),
      resolution: incidentRow.resolucion == null ? null : String(incidentRow.resolucion),
    };
    const originLot: Lot = {
      id: originId, code: String(origin.codigo), productId: String(origin.producto_id),
      productName: String(origin.nombre_producto), productType: origin.tipo_producto as Lot['productType'],
      supplierId: origin.proveedor_id == null ? null : String(origin.proveedor_id),
      supplierLotCode: origin.codigo_lote_proveedor == null ? null : String(origin.codigo_lote_proveedor),
      originType: origin.tipo_origen as Lot['originType'],
      initialQuantity: quantity(origin.cantidad_inicial), originAt: date(origin.fecha_origen),
      expirationDate: origin.fecha_caducidad == null ? null :
        origin.fecha_caducidad instanceof Date
          ? origin.fecha_caducidad.toISOString().slice(0, 10)
          : String(origin.fecha_caducidad).slice(0, 10),
      unit: origin.unidad_medida as Unit, registeredBy: String(origin.registrado_por),
      createdAt: date(origin.created_at), physicalQuantity: fmt(originTotals.physical),
      usableQuantity: fmt(originTotals.usable), blocked: blocked.has(originId),
      expired: isExpired(origin), exhausted: originTotals.physical === 0n,
      graphSyncStatus: before.pending || after.pending ? 'PENDIENTE' : 'SINCRONIZADO',
    };
    const partial = warnings.length > 0 || traversal.status === 'PARCIAL' ||
      quality.status !== 'COMPLETO' || stockTruncated || destTruncated || blocksTruncated;
    const sources = {
      postgresql: source('NOT_APPLICABLE', null), mongodb: mongoSource,
      neo4j: source(before.pending || after.pending ? 'PENDING' : 'SYNCHRONIZED',
        after.pending),
    };
    return {
      status: partial ? 'PARCIAL' : 'COMPLETO', queryType: 'IMPACT',
      incident, originLot, summary: { originLots: 1,
        directLots: traversal.lots.filter((lot) => lot.depth === 1).length,
        indirectLots: traversal.lots.filter((lot) => lot.depth > 1).length,
        totalAffectedLots: ids.length,
        destinationCount,
        blockedLots: affectedLots.filter((item) => item.blocked).length },
      affectedLots,
      stockByLocation: { status: stockTruncated ? 'PARCIAL' : 'COMPLETO',
        data: stockRows, warnings: details(stockTruncated) },
      destinations: { status: destTruncated ? 'PARCIAL' : 'COMPLETO',
        data: destinations, warnings: details(destTruncated) },
      quality,
      blocks: { status: blocksTruncated ? 'PARCIAL' : 'COMPLETO',
        data: activeBlocks, warnings: details(blocksTruncated) },
      graph: visual.graph,
      metadata: { maxDepth, analysisTruncated: traversal.status === 'PARCIAL',
        visualizationTruncated: visual.visualizationTruncated,
        graphSynchronized: !before.pending && !after.pending && before.sequence === after.sequence,
        warnings, durationMs: performance.now() - started,
        analyzedAt: new Date().toISOString(), sourceStatus: sources },
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.graph.close();
  }
}
