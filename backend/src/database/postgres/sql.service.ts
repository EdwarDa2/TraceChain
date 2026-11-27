import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { validateEnv } from '../../config/env.validation.mts';

@Injectable()
export class SqlService implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: validateEnv(process.env).DATABASE_URL, max: 12 });

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
