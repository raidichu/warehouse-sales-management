import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { StockReceiptsService, CreateStockReceiptDto } from './stock-receipts.service';
import { StockIssuesService, CreateStockIssueDto } from './stock-issues.service';
import { StockTransfersService, CreateStockTransferDto } from './stock-transfers.service';
import { StockTakingService, CreateStockTakingDto } from './stock-taking.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

class InventoryQueryDto extends PaginationDto {
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsString() belowMin?: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(
    private inventorySvc: InventoryService,
    private receiptsSvc: StockReceiptsService,
    private issuesSvc: StockIssuesService,
    private transfersSvc: StockTransfersService,
    private takingSvc: StockTakingService,
  ) {}

  // Inventory
  @Get('inventory')
  @Permissions('inventory:read')
  getInventory(@Query() q: InventoryQueryDto) {
    return this.inventorySvc.findAll({ ...q, belowMin: q.belowMin === 'true' });
  }

  @Get('inventory/transactions')
  @Permissions('inventory:read')
  getTransactions(@Query() q: PaginationDto & { warehouseId?: string; productId?: string; type?: string }) {
    return this.inventorySvc.getTransactions(q);
  }

  // Stock Receipts
  @Get('stock/receipts')
  @Permissions('inventory:read')
  findReceipts(@Query() q: PaginationDto & { warehouseId?: string }) {
    return this.receiptsSvc.findAll(q);
  }

  @Get('stock/receipts/:id')
  @Permissions('inventory:read')
  findReceipt(@Param('id') id: string) { return this.receiptsSvc.findOne(id); }

  @Post('stock/receipts')
  @Permissions('stock:receipt')
  createReceipt(@Body() dto: CreateStockReceiptDto, @CurrentUser() u: JwtPayload) {
    return this.receiptsSvc.create(dto, u.sub);
  }

  @Patch('stock/receipts/:id/confirm')
  @Permissions('stock:receipt')
  confirmReceipt(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.receiptsSvc.confirm(id, u.sub);
  }

  @Patch('stock/receipts/:id/cancel')
  @Permissions('stock:receipt')
  cancelReceipt(@Param('id') id: string) { return this.receiptsSvc.cancel(id); }

  // Stock Issues
  @Get('stock/issues')
  @Permissions('inventory:read')
  findIssues(@Query() q: PaginationDto) { return this.issuesSvc.findAll(q); }

  @Get('stock/issues/:id')
  @Permissions('inventory:read')
  findIssue(@Param('id') id: string) { return this.issuesSvc.findOne(id); }

  @Post('stock/issues')
  @Permissions('stock:issue')
  createIssue(@Body() dto: CreateStockIssueDto, @CurrentUser() u: JwtPayload) {
    return this.issuesSvc.create(dto, u.sub);
  }

  @Patch('stock/issues/:id/confirm')
  @Permissions('stock:issue')
  confirmIssue(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.issuesSvc.confirm(id, u.sub);
  }

  // Stock Transfers
  @Get('stock/transfers')
  @Permissions('inventory:read')
  findTransfers(@Query() q: PaginationDto) { return this.transfersSvc.findAll(q); }

  @Get('stock/transfers/:id')
  @Permissions('inventory:read')
  findTransfer(@Param('id') id: string) { return this.transfersSvc.findOne(id); }

  @Post('stock/transfers')
  @Permissions('stock:transfer')
  createTransfer(@Body() dto: CreateStockTransferDto, @CurrentUser() u: JwtPayload) {
    return this.transfersSvc.create(dto, u.sub);
  }

  @Patch('stock/transfers/:id/confirm')
  @Permissions('stock:transfer')
  confirmTransfer(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.transfersSvc.confirm(id, u.sub);
  }

  // Stock Taking
  @Get('stock/taking')
  @Permissions('inventory:read')
  findTakings(@Query() q: PaginationDto) { return this.takingSvc.findAll(q); }

  @Get('stock/taking/:id')
  @Permissions('inventory:read')
  findTaking(@Param('id') id: string) { return this.takingSvc.findOne(id); }

  @Post('stock/taking')
  @Permissions('stock:taking')
  createTaking(@Body() dto: CreateStockTakingDto, @CurrentUser() u: JwtPayload) {
    return this.takingSvc.create(dto, u.sub);
  }

  @Patch('stock/taking/:id/complete')
  @Permissions('stock:taking')
  completeTaking(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.takingSvc.complete(id, u.sub);
  }
}
