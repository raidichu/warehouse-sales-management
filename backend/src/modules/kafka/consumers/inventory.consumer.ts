import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { KAFKA_TOPICS, GrnConfirmedEvent, GdnConfirmedEvent } from '../events/warehouse.events';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller()
export class InventoryConsumer {
  private readonly logger = new Logger(InventoryConsumer.name);

  constructor(private readonly prisma: PrismaService) {}

  @EventPattern(KAFKA_TOPICS.GRN_CONFIRMED)
  async handleGrnConfirmed(@Payload() data: GrnConfirmedEvent, @Ctx() ctx: KafkaContext) {
    const message = ctx.getMessage();
    const { offset, partition } = message as any;
    this.logger.log(`[p=${partition} o=${offset}] GRN confirmed: ${data.grnNumber}`);

    try {
      // Check if any product crossed back above minStockQty after receipt
      const productIds = data.lines.map((l) => l.productId);
      const inventories = await this.prisma.inventory.findMany({
        where: { productId: { in: productIds }, warehouseId: data.warehouseId },
        include: { product: { select: { sku: true, name: true, minStockQty: true } } },
      });

      for (const inv of inventories) {
        if (Number(inv.quantity) >= Number(inv.product.minStockQty)) {
          this.logger.log(`Stock OK: ${inv.product.sku} = ${inv.quantity} units (min: ${inv.product.minStockQty})`);
        }
      }

      await ctx.getConsumer().commitOffsets([
        { topic: KAFKA_TOPICS.GRN_CONFIRMED, partition, offset: String(Number(offset) + 1) },
      ]);
    } catch (err) {
      this.logger.error(`Failed to handle ${data.grnNumber}: ${err.message}`, err.stack);
      throw err;
    }
  }

  @EventPattern(KAFKA_TOPICS.GDN_CONFIRMED)
  async handleGdnConfirmed(@Payload() data: GdnConfirmedEvent, @Ctx() ctx: KafkaContext) {
    const message = ctx.getMessage();
    const { offset, partition } = message as any;
    this.logger.log(`[p=${partition} o=${offset}] GDN confirmed: ${data.gdnNumber}`);

    try {
      // Check for low-stock after delivery
      const productIds = data.lines.map((l) => l.productId);
      const inventories = await this.prisma.inventory.findMany({
        where: { productId: { in: productIds }, warehouseId: data.warehouseId },
        include: { product: { select: { sku: true, name: true, minStockQty: true } } },
      });

      for (const inv of inventories) {
        if (Number(inv.quantity) < Number(inv.product.minStockQty)) {
          this.logger.warn(
            `LOW STOCK: ${inv.product.sku} at ${inv.quantity} units (min: ${inv.product.minStockQty})`,
          );
          // TODO: trigger notification / push alert
        }
      }

      await ctx.getConsumer().commitOffsets([
        { topic: KAFKA_TOPICS.GDN_CONFIRMED, partition, offset: String(Number(offset) + 1) },
      ]);
    } catch (err) {
      this.logger.error(`Failed to handle ${data.gdnId}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
