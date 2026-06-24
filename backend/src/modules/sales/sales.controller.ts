import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CustomersService, CreateCustomerDto } from './customers.service';
import { QuotationsService, CreateQuotationDto } from './quotations.service';
import { SalesOrdersService, CreateSODto } from './sales-orders.service';
import { GoodsDeliveryNotesService, CreateGDNDto } from './goods-delivery-notes.service';
import { InvoicesService, CreateInvoiceDto } from './invoices.service';
import { AccountsReceivableService } from './accounts-receivable.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

class PaymentDto {
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @IsString() notes?: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(
    private customerSvc: CustomersService,
    private quotationSvc: QuotationsService,
    private soSvc: SalesOrdersService,
    private gdnSvc: GoodsDeliveryNotesService,
    private invoiceSvc: InvoicesService,
    private arSvc: AccountsReceivableService,
  ) {}

  // Customers
  @Get('customers')
  @Permissions('customer:read')
  findCustomers(@Query() q: PaginationDto) { return this.customerSvc.findAll(q); }

  @Get('customers/:id')
  @Permissions('customer:read')
  findCustomer(@Param('id') id: string) { return this.customerSvc.findOne(id); }

  @Post('customers')
  @Permissions('customer:manage')
  createCustomer(@Body() dto: CreateCustomerDto) { return this.customerSvc.create(dto); }

  @Patch('customers/:id')
  @Permissions('customer:manage')
  updateCustomer(@Param('id') id: string, @Body() dto: Partial<CreateCustomerDto>) {
    return this.customerSvc.update(id, dto);
  }

  // Quotations
  @Get('quotations')
  @Permissions('quotation:read')
  findQuotations(@Query() q: PaginationDto & { customerId?: string; status?: string }) {
    return this.quotationSvc.findAll(q);
  }

  @Get('quotations/:id')
  @Permissions('quotation:read')
  findQuotation(@Param('id') id: string) { return this.quotationSvc.findOne(id); }

  @Post('quotations')
  @Permissions('quotation:create')
  createQuotation(@Body() dto: CreateQuotationDto, @CurrentUser() u: JwtPayload) {
    return this.quotationSvc.create(dto, u.sub);
  }

  @Patch('quotations/:id/send')
  @Permissions('quotation:create')
  sendQuotation(@Param('id') id: string) { return this.quotationSvc.send(id); }

  @Patch('quotations/:id/accept')
  @Permissions('quotation:create')
  acceptQuotation(@Param('id') id: string) { return this.quotationSvc.accept(id); }

  @Patch('quotations/:id/reject')
  @Permissions('quotation:create')
  rejectQuotation(@Param('id') id: string) { return this.quotationSvc.reject(id); }

  // Sales Orders
  @Get('sales-orders')
  @Permissions('so:read')
  findSOs(@Query() q: PaginationDto & { customerId?: string; status?: string }) { return this.soSvc.findAll(q); }

  @Get('sales-orders/:id')
  @Permissions('so:read')
  findSO(@Param('id') id: string) { return this.soSvc.findOne(id); }

  @Post('sales-orders')
  @Permissions('so:create')
  createSO(@Body() dto: CreateSODto, @CurrentUser() u: JwtPayload) { return this.soSvc.create(dto, u.sub); }

  @Patch('sales-orders/:id/confirm')
  @Permissions('so:confirm')
  confirmSO(@Param('id') id: string, @CurrentUser() u: JwtPayload) { return this.soSvc.confirm(id, u.sub); }

  @Patch('sales-orders/:id/cancel')
  @Permissions('so:create')
  cancelSO(@Param('id') id: string, @CurrentUser() u: JwtPayload) { return this.soSvc.cancel(id, u.sub); }

  // Goods Delivery Notes
  @Get('goods-delivery-notes')
  @Permissions('gdn:create')
  findGDNs(@Query() q: PaginationDto & { soId?: string; status?: string }) { return this.gdnSvc.findAll(q); }

  @Get('goods-delivery-notes/:id')
  @Permissions('gdn:create')
  findGDN(@Param('id') id: string) { return this.gdnSvc.findOne(id); }

  @Post('goods-delivery-notes')
  @Permissions('gdn:create')
  createGDN(@Body() dto: CreateGDNDto, @CurrentUser() u: JwtPayload) { return this.gdnSvc.create(dto, u.sub); }

  @Patch('goods-delivery-notes/:id/confirm')
  @Permissions('gdn:confirm')
  confirmGDN(@Param('id') id: string, @CurrentUser() u: JwtPayload) { return this.gdnSvc.confirm(id, u.sub); }

  // Invoices
  @Get('invoices')
  @Permissions('invoice:create')
  findInvoices(@Query() q: PaginationDto & { customerId?: string; status?: string }) { return this.invoiceSvc.findAll(q); }

  @Get('invoices/:id')
  @Permissions('invoice:create')
  findInvoice(@Param('id') id: string) { return this.invoiceSvc.findOne(id); }

  @Post('invoices')
  @Permissions('invoice:create')
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() u: JwtPayload) {
    return this.invoiceSvc.create(dto, u.sub);
  }

  @Patch('invoices/:id/confirm')
  @Permissions('invoice:confirm')
  confirmInvoice(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.invoiceSvc.confirm(id, u.sub);
  }

  @Patch('invoices/:id/cancel')
  @Permissions('invoice:confirm')
  cancelInvoice(@Param('id') id: string) { return this.invoiceSvc.cancel(id); }

  // Accounts Receivable
  @Get('accounts-receivable')
  @Permissions('ar:manage')
  findARs(@Query() q: PaginationDto & { customerId?: string; status?: string }) { return this.arSvc.findAll(q); }

  @Get('accounts-receivable/aging')
  @Permissions('ar:manage')
  arAging() { return this.arSvc.getAgingSummary(); }

  @Get('accounts-receivable/:id')
  @Permissions('ar:manage')
  findAR(@Param('id') id: string) { return this.arSvc.findOne(id); }

  @Post('accounts-receivable/:id/payment')
  @Permissions('ar:manage')
  recordARPayment(@Param('id') id: string, @Body() dto: PaymentDto) {
    return this.arSvc.recordPayment(id, dto.amount, dto.notes);
  }
}
