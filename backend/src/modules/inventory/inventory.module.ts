import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockReceiptsService } from './stock-receipts.service';
import { StockIssuesService } from './stock-issues.service';
import { StockTransfersService } from './stock-transfers.service';
import { StockTakingService } from './stock-taking.service';

@Module({
  controllers: [InventoryController],
  providers: [
    InventoryService,
    StockReceiptsService,
    StockIssuesService,
    StockTransfersService,
    StockTakingService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
