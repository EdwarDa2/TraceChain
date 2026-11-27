import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import neo4j, { type Driver } from 'neo4j-driver';
import { SqlService } from '../../database/postgres/sql.service';
import { createBlockRepository, createIncidentRepository } from '../../database/postgres/incident-repositories.mts';
import { createSqlOperationsDeps } from '../../database/postgres/operations-repository.mts';
import { createIdempotencyStore } from '../../database/postgres/transaction.mts';
import { verifyDescendant } from '../../database/neo4j/verification.mts';
import { validateEnv } from '../../config/env.validation.mts';
import { evaluarPertinencia, type Verification } from './block-service.mts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function instant(value: string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}
function asResponse(block: Awaited<ReturnType<ReturnType<typeof createBlockRepository>['createMany']>>[number]) {
  return { ...block, blockedAt: instant(block.blockedAt)!, releasedAt: instant(block.releasedAt) };
}

@Injectable()
export class BlockWriteService implements OnModuleDestroy {
  private readonly config = validateEnv(process.env);
  private readonly graph: Driver = neo4j.driver(this.config.NEO4J_URI,
    neo4j.auth.basic(this.config.NEO4J_USER, this.config.NEO4J_PASSWORD));
  constructor(private readonly sql: SqlService) {}

  async block(incidentId: string, lotIds: string[], reason: string, actorId: string, key: string) {
    if (!Array.isArray(lotIds) || lotIds.length < 1 || lotIds.length > 100 ||
        lotIds.some((id) => typeof id !== 'string' || !UUID.test(id)) ||
        new Set(lotIds).size !== lotIds.length ||
        typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 5000) {
      throw new Error('VALIDATION_ERROR');
    }
    const operation = 'POST /incidents/:id/blocks';
    const hash = createHash('sha256').update(JSON.stringify({
      pathParams: { id: incidentId }, body: { lotIds, reason },
    })).digest('hex');
    const request = { actorId, operacion: operation, clave: key, hash };
    const previous = (await this.sql.pool.query<{ request_hash: string; response_body: unknown }>(
      `SELECT request_hash,response_body FROM solicitudes_idempotentes
       WHERE usuario_id=$1 AND operacion=$2 AND clave=$3`, [actorId, operation, key])).rows[0];
    if (previous) {
      if (previous.request_hash !== hash) throw new Error('IDEMPOTENCY_CONFLICT');
      return previous.response_body;
    }
    const incident = (await this.sql.pool.query<{ lote_origen_id: string; estado: string }>(
      'SELECT lote_origen_id,estado FROM incidencias WHERE id=$1', [incidentId])).rows[0];
    if (!incident) throw new Error('RESOURCE_NOT_FOUND');
    if (incident.estado === 'CERRADA') throw new Error('INCIDENT_CLOSED');
    const checks = new Map<string, Verification>();
    // No mantener transacción SQL mientras Neo4j verifica descendencia.
    for (const id of lotIds) {
      if (id !== incident.lote_origen_id) {
        checks.set(id, await verifyDescendant(this.sql.pool, this.graph,
          this.config.NEO4J_DATABASE, incident.lote_origen_id, id));
      }
    }
    const verdict = evaluarPertinencia({ incidentId, originLotId: incident.lote_origen_id,
      lotIds, reason }, { id: incidentId, status: incident.estado as 'ABIERTA' | 'EN_ANALISIS' },
    checks);
    if (verdict) throw new Error(verdict);
    const txManager = createSqlOperationsDeps(this.sql.pool).transaction;
    const store = createIdempotencyStore();
    const incidents = createIncidentRepository();
    const blocks = createBlockRepository();
    return txManager.run(async (tx) => {
      const reservation = await store.reserve(request, tx);
      if (reservation.replay) return reservation.body;
      const current = await incidents.lock(incidentId, tx);
      if (!current) throw new Error('RESOURCE_NOT_FOUND');
      if (current.status === 'CERRADA') throw new Error('INCIDENT_CLOSED');
      if (current.originLotId !== incident.lote_origen_id) throw new Error('INVALID_REFERENCE');
      const sorted = [...lotIds].sort();
      const locked = await tx.query('SELECT id FROM lotes WHERE id=ANY($1) ORDER BY id FOR UPDATE', [sorted]);
      if (locked.rows.length !== sorted.length) throw new Error('RESOURCE_NOT_FOUND');
      const active = await blocks.activeByLots(sorted, tx);
      if (active.some((block) => block.incidentId === incidentId)) throw new Error('BLOCK_ALREADY_ACTIVE');
      const created = (await blocks.createMany(incidentId, sorted, reason, actorId, tx)).map(asResponse);
      await store.confirm(request, 201, created, tx);
      return created;
    });
  }

  async release(blockId: string, reason: string, actorId: string, key: string) {
    if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 5000) {
      throw new Error('VALIDATION_ERROR');
    }
    const request = { actorId, operacion: 'POST /lot-blocks/:id/release', clave: key,
      hash: createHash('sha256').update(JSON.stringify({
        pathParams: { id: blockId }, body: { reason },
      })).digest('hex') };
    const store = createIdempotencyStore();
    return createSqlOperationsDeps(this.sql.pool).transaction.run(async (tx) => {
      const reservation = await store.reserve(request, tx);
      if (reservation.replay) return reservation.body;
      const row = (await tx.query('SELECT * FROM bloqueos_lotes WHERE id=$1 FOR UPDATE', [blockId])).rows[0];
      if (!row) throw new Error('RESOURCE_NOT_FOUND');
      if (row.activo !== true) throw new Error('BLOCK_ALREADY_RELEASED');
      const blocks = createBlockRepository();
      const released = await blocks.release(blockId, reason, actorId, tx);
      const remaining = (await blocks.activeByLots([released.lotId], tx)).length;
      const result = { blockId, active: false as const, lotId: released.lotId,
        lotBlocked: remaining > 0, remainingActiveBlocks: remaining };
      await store.confirm(request, 200, result, tx);
      return result;
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.graph.close();
  }
}
