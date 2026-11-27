import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.controller';
import { ImpactService } from './impact.service';

@Controller('api/v1/incidents')
@UseGuards(AuthGuard)
export class ImpactController {
  constructor(private readonly impact: ImpactService) {}

  @Get(':id/impact')
  async get(@Param('id') id: string, @Query() query: Record<string, unknown>,
    @Req() _request: { actor: { id: string } }) {
    if (Object.keys(query).some((key) => key !== 'maxDepth') ||
        query.maxDepth !== undefined &&
          (typeof query.maxDepth !== 'string' || !/^(?:[1-9]|1[0-9]|20)$/.test(query.maxDepth))) {
      throw new Error('VALIDATION_ERROR');
    }
    return { data: await this.impact.get(id, query.maxDepth === undefined ? 10 : Number(query.maxDepth)) };
  }
}
