import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { CustomersService } from './customers.service';
import { QuotationsService } from './quotations.service';
import { SalesOrdersService } from './sales-orders.service';
import { GoodsDeliveryNotesService } from './goods-delivery-notes.service';
import { InvoicesService } from './invoices.service';
import { AccountsReceivableService } from './accounts-receivable.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [SalesController],
  providers: [
    CustomersService,
    QuotationsService,
    SalesOrdersService,
    GoodsDeliveryNotesService,
    InvoicesService,
    AccountsReceivableService,
  ],
})
export class SalesModule {}
