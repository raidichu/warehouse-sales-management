import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ProductsService, CreateProductDto, CreateCategoryDto, CreateUomDto } from './products.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { IsOptional, IsString } from 'class-validator';

class ProductQueryDto extends PaginationDto {
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() status?: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private svc: ProductsService) {}

  // Products
  @Get('products')
  @Permissions('product:read')
  findAll(@Query() q: ProductQueryDto) { return this.svc.findAll(q); }

  @Get('products/:id')
  @Permissions('product:read')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post('products')
  @Permissions('product:create')
  create(@Body() dto: CreateProductDto) { return this.svc.create(dto); }

  @Put('products/:id')
  @Permissions('product:update')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProductDto>) { return this.svc.update(id, dto); }

  @Patch('products/:id/deactivate')
  @Permissions('product:delete')
  deactivate(@Param('id') id: string) { return this.svc.deactivate(id); }

  // Categories
  @Get('products/categories/list')
  @Permissions('product:read')
  findAllCategories() { return this.svc.findAllCategories(); }

  @Post('products/categories')
  @Permissions('product:create')
  createCategory(@Body() dto: CreateCategoryDto) { return this.svc.createCategory(dto); }

  @Put('products/categories/:id')
  @Permissions('product:update')
  updateCategory(@Param('id') id: string, @Body() dto: Partial<CreateCategoryDto>) {
    return this.svc.updateCategory(id, dto);
  }

  // UoM
  @Get('uom')
  @Permissions('product:read')
  findAllUoms() { return this.svc.findAllUoms(); }

  @Post('uom')
  @Permissions('product:create')
  createUom(@Body() dto: CreateUomDto) { return this.svc.createUom(dto); }
}
