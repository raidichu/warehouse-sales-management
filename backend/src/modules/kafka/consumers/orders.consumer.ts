import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { KAFKA_TOPICS, SoConfirmedEvent, InvoiceConfirmedEvent } from '../events/warehouse.events';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller()
export class OrdersConsumer {
  private readonly logger = new Logger(OrdersConsumer.name);

  constructor(private readonly prisma: PrismaService) {}

  @EventPattern(KAFKA_TOPICS.SO_CONFIRMED)
  async handleSoConfirmed(@Payload() data: SoConfirmedEvent, @Ctx() ctx: KafkaContext) {
    const message = ctx.getMessage();
    const { offset, partition } = message as any;
    this.logger.log(`[p=${partition} o=${offset}] SO confirmed: ${data.soNumber}`);

    try {
      // Example: log order event, trigger CRM webhook, update analytics cache
      this.logger.log(`Customer ${data.customerId} confirmed SO ${data.soNumber} worth ${data.grandTotal}`);
      // TODO: integrate notification / CRM / analytics pipeline here

      await ctx.getConsumer().commitOffsets([
        { topic: KAFKA_TOPICS.SO_CONFIRMED, partition, offset: String(Number(offset) + 1) },
      ]);
    } catch (err) {
      this.logger.error(`Failed to handle SO ${data.soId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  @EventPattern(KAFKA_TOPICS.INVOICE_CONFIRMED)
  async handleInvoiceConfirmed(@Payload() data: InvoiceConfirmedEvent, @Ctx() ctx: KafkaContext) {
    const message = ctx.getMessage();
    const { offset, partition } = message as any;
    this.logger.log(`[p=${partition} o=${offset}] Invoice confirmed: ${data.invoiceNumber}`);

    try {
      // Example: schedule payment reminder, send invoice email
      this.logger.log(`Invoice ${data.invoiceNumber} due ${data.dueDate}, total: ${data.grandTotal}`);
      // TODO: trigger email notification, schedule payment reminder

      await ctx.getConsumer().commitOffsets([
        { topic: KAFKA_TOPICS.INVOICE_CONFIRMED, partition, offset: String(Number(offset) + 1) },
      ]);
    } catch (err) {
      this.logger.error(`Failed to handle invoice ${data.invoiceId}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
