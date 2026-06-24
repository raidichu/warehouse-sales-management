import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PurchaseOrdersService, CreatePODto } from './purchase-orders.service';
import { GoodsReceiptNotesService, CreateGRNDto } from './goods-receipt-notes.service';
import { SuppliersService, CreateSupplierDto } from './suppliers.service';
import { AccountsPayableService } from './accounts-payable.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

class PaymentDto {
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() notes?: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasesController {
  constructor(
    private poSvc: PurchaseOrdersService,
    private grnSvc: GoodsReceiptNotesService,
    private supplierSvc: SuppliersService,
    private apSvc: AccountsPayableService,
  ) {}

  // Suppliers
  @Get('suppliers')
  @Permissions('supplier:read')
  findSuppliers(@Query() q: PaginationDto) { return this.supplierSvc.findAll(q); }

  @Get('suppliers/:id')
  @Permissions('supplier:read')
  findSupplier(@Param('id') id: string) { return this.supplierSvc.findOne(id); }

  @Post('suppliers')
  @Permissions('supplier:manage')
  createSupplier(@Body() dto: CreateSupplierDto) { return this.supplierSvc.create(dto); }

  @Patch('suppliers/:id')
  @Permissions('supplier:manage')
  updateSupplier(@Param('id') id: string, @Body() dto: Partial<CreateSupplierDto>) { return this.supplierSvc.update(id, dto); }

  // Purchase Orders
  @Get('purchase-orders')
  @Permissions('po:read')
  findPOs(@Query() q: PaginationDto & { supplierId?: string; status?: string }) { return this.poSvc.findAll(q); }

  @Get('purchase-orders/:id')
  @Permissions('po:read')
  findPO(@Param('id') id: string) { return this.poSvc.findOne(id); }

  @Post('purchase-orders')
  @Permissions('po:create')
  createPO(@Body() dto: CreatePODto, @CurrentUser() u: JwtPayload) { return this.poSvc.create(dto, u.sub); }

  @Patch('purchase-orders/:id/submit')
  @Permissions('po:create')
  submitPO(@Param('id') id: string) { return this.poSvc.submit(id); }

  @Patch('purchase-orders/:id/approve')
  @Permissions('po:approve')
  approvePO(@Param('id') id: string, @CurrentUser() u: JwtPayload) { return this.poSvc.approve(id, u.sub); }

  @Patch('purchase-orders/:id/cancel')
  @Permissions('po:create')
  cancelPO(@Param('id') id: string) { return this.poSvc.cancel(id); }

  // GRN
  @Get('goods-receipt-notes')
  @Permissions('grn:create')
  findGRNs(@Query() q: PaginationDto & { supplierId?: string; status?: string }) { return this.grnSvc.findAll(q); }

  @Get('goods-receipt-notes/:id')
  @Permissions('grn:create')
  findGRN(@Param('id') id: string) { return this.grnSvc.findOne(id); }

  @Post('goods-receipt-notes')
  @Permissions('grn:create')
  createGRN(@Body() dto: CreateGRNDto, @CurrentUser() u: JwtPayload) { return this.grnSvc.create(dto, u.sub); }

  @Patch('goods-receipt-notes/:id/confirm')
  @Permissions('grn:confirm')
  confirmGRN(@Param('id') id: string, @CurrentUser() u: JwtPayload) { return this.grnSvc.confirm(id, u.sub); }

  // Accounts Payable
  @Get('accounts-payable')
  @Permissions('ap:manage')
  findAPs(@Query() q: PaginationDto & { supplierId?: string; status?: string }) { return this.apSvc.findAll(q); }

  @Get('accounts-payable/:id')
  @Permissions('ap:manage')
  findAP(@Param('id') id: string) { return this.apSvc.findOne(id); }

  @Post('accounts-payable/:id/payment')
  @Permissions('ap:manage')
  recordPayment(@Param('id') id: string, @Body() dto: PaymentDto) {
    return this.apSvc.recordPayment(id, dto.amount, dto.notes);
  }
}
