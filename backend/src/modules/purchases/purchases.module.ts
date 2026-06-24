import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { GoodsReceiptNotesService } from './goods-receipt-notes.service';
import { SuppliersService } from './suppliers.service';
import { AccountsPayableService } from './accounts-payable.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [PurchasesController],
  providers: [
    PurchaseOrdersService,
    GoodsReceiptNotesService,
    SuppliersService,
    AccountsPayableService,
  ],
})
export class PurchasesModule {}
