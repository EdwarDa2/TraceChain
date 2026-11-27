import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { validateEnv } from '../../config/env.validation.mts';

@Injectable()
export class MongoService implements OnModuleDestroy {
  private readonly config = validateEnv(process.env);
  readonly client = new MongoClient(this.config.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  readonly db = this.client.db(this.config.MONGODB_DATABASE);

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
