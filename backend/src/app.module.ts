import { Module } from '@nestjs/common';
import { OutboxService } from './integration/outbox/outbox.service';

@Module({ providers: [OutboxService] })
export class AppModule {}
