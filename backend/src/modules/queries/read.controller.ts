import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.controller';
import { ReadService } from './read.service';

type Query = Record<string, unknown>;

@Controller('api/v1')
@UseGuards(AuthGuard)
export class ReadController {
  constructor(private readonly service: ReadService) {}

  @Get('suppliers')
  suppliers(@Query() query: Query) { return this.service.suppliers(query); }

  @Get('suppliers/:id')
  supplier(@Param('id') id: string) { return this.service.supplier(id); }

  @Get('products')
  products(@Query() query: Query) { return this.service.products(query); }

  @Get('products/:id')
  product(@Param('id') id: string) { return this.service.product(id); }

  @Get('locations')
  locations(@Query() query: Query) { return this.service.locations(query); }

  @Get('locations/:id')
  location(@Param('id') id: string) { return this.service.location(id); }

  @Get('lots')
  lots(@Query() query: Query) { return this.service.lots(query); }

  @Get('lots/:id/details')
  lotDetails(@Param('id') id: string) { return this.service.lotDetails(id); }

  @Get('lots/:id/blocks')
  lotBlocks(@Param('id') id: string, @Query() query: Query) { return this.service.lotBlocks(id, query); }

  @Get('lots/:id')
  lot(@Param('id') id: string) { return this.service.lot(id); }

  @Get('inventory')
  inventory(@Query() query: Query) { return this.service.inventory(query); }

  @Get('inventory/movements')
  movements(@Query() query: Query) { return this.service.movements(query); }

  @Get('production-orders')
  productionOrders(@Query() query: Query) { return this.service.productionOrders(query); }

  @Get('production-orders/:id')
  productionOrder(@Param('id') id: string) { return this.service.productionOrder(id); }

  @Get('distributions')
  distributions(@Query() query: Query) { return this.service.distributions(query); }

  @Get('distributions/:id')
  distribution(@Param('id') id: string) { return this.service.distribution(id); }

  @Get('inspection-templates/active')
  activeTemplate(@Query() query: Query) {
    if (query.productId === undefined || Object.keys(query).length !== 1) throw new Error('VALIDATION_ERROR');
    return this.service.activeTemplate(String(query.productId));
  }

  @Get('inspection-templates/:id')
  template(@Param('id') id: string) { return this.service.template(id); }

  @Get('inspections')
  inspections(@Query() query: Query) { return this.service.inspections(query); }

  @Get('inspections/:id')
  inspection(@Param('id') id: string) { return this.service.inspection(id); }

  @Get('quality/summary')
  qualitySummary(@Query() query: Query) { return this.service.qualitySummary(query); }

  @Get('quality/findings')
  qualityFindings(@Query() query: Query) { return this.service.qualityFindings(query); }

  @Get('incidents')
  incidents(@Query() query: Query) { return this.service.incidents(query); }

  @Get('incidents/:id/dossier')
  dossier(@Param('id') id: string) { return this.service.dossier(id); }

  @Get('incidents/:id/blocks')
  incidentBlocks(@Param('id') id: string, @Query() query: Query) { return this.service.incidentBlocks(id, query); }

  @Get('incidents/:id')
  incident(@Param('id') id: string) { return this.service.incident(id); }

  @Get('dashboard/summary')
  dashboardSummary() { return this.service.dashboardSummary(); }

  @Get('dashboard/recent-activity')
  recentActivity(@Query() query: Query) { return this.service.recentActivity(query); }

  @Get('system/sync-status')
  systemStatus() { return this.service.systemStatus(); }
}
