import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

class DateRangeQuery {
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @Get('dashboard')
  @Permissions('reports:read')
  dashboard() { return this.svc.dashboard(); }

  @Get('inventory-summary')
  @Permissions('reports:read')
  inventorySummary(@Query('warehouseId') warehouseId?: string) {
    return this.svc.inventorySummary(warehouseId);
  }

  @Get('stock-movements')
  @Permissions('reports:read')
  stockMovements(@Query() q: DateRangeQuery) {
    return this.svc.stockMovements(q);
  }

  @Get('sales-revenue')
  @Permissions('reports:read')
  salesRevenue(@Query() q: DateRangeQuery) {
    return this.svc.salesRevenue({ from: q.from, to: q.to, customerId: q.customerId });
  }

  @Get('purchases')
  @Permissions('reports:read')
  purchaseSummary(@Query() q: DateRangeQuery) {
    return this.svc.purchaseSummary({ from: q.from, to: q.to, supplierId: q.supplierId });
  }

  @Get('ar-aging')
  @Permissions('reports:read')
  arAging() { return this.svc.arAgingReport(); }

  @Get('ap-aging')
  @Permissions('reports:read')
  apAging() { return this.svc.apAgingReport(); }
}
