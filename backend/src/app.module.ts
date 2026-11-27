import { Module } from '@nestjs/common';
import { OutboxService } from './integration/outbox/outbox.service';
import { SqlService } from './database/postgres/sql.service';
import { AuthController, AuthGuard, OperatorGuard, AnalystGuard } from './modules/auth/auth.controller';
import { OperationsController, OperationsService } from './modules/operations/operations.controller';
import { MongoService } from './database/mongodb/mongo.service';
import { InspectionsService } from './modules/inspections/inspections.service';
import { InspectionsController } from './modules/inspections/inspections.controller';
import { IncidentsController } from './modules/incidents/incidents.controller';
import { IncidentWriteService } from './modules/incidents/incident-write.service';
import { BlockWriteService } from './modules/lot-blocks/block-write.service';
import { IncidentBlocksController, LotBlocksController } from './modules/lot-blocks/blocks.controller';
import { ImpactService } from './modules/impact/impact.service';
import { ImpactController } from './modules/impact/impact.controller';
import { TraceabilityService } from './modules/traceability/traceability.service';
import { TraceabilityController } from './modules/traceability/traceability.controller';
import { APP_FILTER } from '@nestjs/core';
import { ApiErrorFilter } from './common/api-error.filter';

@Module({
  controllers: [AuthController, OperationsController, InspectionsController,
    IncidentsController, IncidentBlocksController, LotBlocksController, ImpactController,
    TraceabilityController],
  providers: [OutboxService, SqlService, MongoService, AuthGuard, OperatorGuard, AnalystGuard,
    OperationsService, InspectionsService, IncidentWriteService, BlockWriteService, ImpactService,
    TraceabilityService,
    { provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule {}
