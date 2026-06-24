import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { WarehousesService, CreateWarehouseDto, CreateLocationDto } from './warehouses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private svc: WarehousesService) {}

  @Get()
  @Permissions('warehouse:read')
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  @Permissions('warehouse:read')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  @Permissions('warehouse:manage')
  create(@Body() dto: CreateWarehouseDto) { return this.svc.create(dto); }

  @Put(':id')
  @Permissions('warehouse:manage')
  update(@Param('id') id: string, @Body() dto: Partial<CreateWarehouseDto>) { return this.svc.update(id, dto); }

  @Post(':id/locations')
  @Permissions('warehouse:manage')
  addLocation(@Param('id') id: string, @Body() dto: CreateLocationDto) { return this.svc.addLocation(id, dto); }

  @Put('locations/:id')
  @Permissions('warehouse:manage')
  updateLocation(@Param('id') id: string, @Body() dto: Partial<CreateLocationDto>) { return this.svc.updateLocation(id, dto); }

  @Get(':id/inventory')
  @Permissions('inventory:read')
  getInventory(@Param('id') id: string) { return this.svc.getInventory(id); }
}
