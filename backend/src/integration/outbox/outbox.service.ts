import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import neo4j, { type Driver } from 'neo4j-driver';
import { Pool } from 'pg';
import { validateEnv } from '../../config/env.validation.mts';
import { applyGraphEvent } from '../handlers/neo4j/projection.mts';
import { applyDossierEvent } from '../handlers/mongodb/dossier-projection.mts';
import { runOutbox } from './dispatcher.mts';

/** Dos consumidores lógicos; conexiones de PostgreSQL dedicadas solo durante cada entrega. */
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private readonly stopped = new AbortController();
  private readonly config = validateEnv(process.env);
  private readonly pool = new Pool({ connectionString: this.config.DATABASE_URL, max: 4 });
  private readonly graph: Driver = neo4j.driver(this.config.NEO4J_URI,
    neo4j.auth.basic(this.config.NEO4J_USER, this.config.NEO4J_PASSWORD));
  private loops: Promise<void>[] = [];

  onModuleInit(): void {
    if (!this.config.OUTBOX_ENABLED) return;
    const options = {
      signal: this.stopped.signal,
      pollMs: this.config.OUTBOX_POLL_INTERVAL_MS,
      maxRetryDelayMs: this.config.OUTBOX_MAX_RETRY_DELAY_MS,
      onDatabaseError: () => this.logger.error('No se pudo procesar la cola de sincronización.'),
    };
    this.loops = [
      runOutbox(this.pool, 'NEO4J',
        (event, signal) => applyGraphEvent(this.graph, this.config.NEO4J_DATABASE, event, signal), options),
      runOutbox(this.pool, 'MONGODB', async (event, signal) => {
        // Una conexión por intento permite cancelar una operación en curso sin
        // interferir con el siguiente intento ni liberar antes el lock SQL.
        const client = new MongoClient(this.config.MONGODB_URI, {
          serverSelectionTimeoutMS: 10_000, socketTimeoutMS: 29_000,
        });
        const cancel = () => { void client.close(); };
        signal.addEventListener('abort', cancel, { once: true });
        try {
          signal.throwIfAborted();
          await client.connect();
          await applyDossierEvent(client.db(this.config.MONGODB_DATABASE), event, signal);
        } finally {
          signal.removeEventListener('abort', cancel);
          await client.close();
        }
      }, options),
    ];
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped.abort();
    try {
      await Promise.all(this.loops);
    } finally {
      await Promise.all([this.graph.close(), this.pool.end()]);
    }
  }
}
