import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OperatorGuard } from '../auth/auth.controller';
import { ReadService } from './read.service';

type Body = Record<string, unknown>;
function object(value: unknown, allowed: string[]): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))) throw new Error('VALIDATION_ERROR');
  return value as Body;
}

@Controller('api/v1')
@UseGuards(OperatorGuard)
export class CatalogWriteController {
  constructor(private readonly service: ReadService) {}

  @Post('suppliers')
  supplier(@Body() value: unknown) {
    const body = object(value, ['code', 'name', 'contactName', 'email', 'phone', 'address']);
    return this.service.createSupplier({ ...body,
      ...(body.contactName !== undefined ? { contacto: body.contactName } : {}),
      ...(body.address !== undefined ? { direccion: body.address } : {}) });
  }

  @Post('products')
  product(@Body() value: unknown) {
    const body = object(value, ['code', 'name', 'description', 'type', 'unit']);
    return this.service.createProduct(body);
  }

  @Post('locations')
  location(@Body() value: unknown) {
    const body = object(value, ['code', 'name', 'type', 'address']);
    return this.service.createLocation(body);
  }

  @Patch('suppliers/:id/status')
  supplierStatus(@Param('id') id: string, @Body() value: unknown) {
    return this.service.patchCatalogStatus('suppliers', id, object(value, ['active']));
  }

  @Patch('products/:id/status')
  productStatus(@Param('id') id: string, @Body() value: unknown) {
    return this.service.patchCatalogStatus('products', id, object(value, ['active']));
  }

  @Patch('locations/:id/status')
  locationStatus(@Param('id') id: string, @Body() value: unknown) {
    return this.service.patchCatalogStatus('locations', id, object(value, ['active']));
  }
}
