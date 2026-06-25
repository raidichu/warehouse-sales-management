import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { KAFKA_CLIENT } from './kafka.module';
import {
  KAFKA_TOPICS,
  GrnConfirmedEvent,
  SoConfirmedEvent,
  GdnConfirmedEvent,
  InvoiceConfirmedEvent,
  InventoryUpdatedEvent,
} from './events/warehouse.events';

type WithoutBase<T> = Omit<T, 'eventId' | 'occurredAt'>;

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(@Inject(KAFKA_CLIENT) private readonly kafka: ClientKafka) {}

  async onModuleInit() {
    await this.kafka.connect();
  }

  async onModuleDestroy() {
    await this.kafka.close();
  }

  emitGrnConfirmed(payload: WithoutBase<GrnConfirmedEvent>) {
    return this.publish<GrnConfirmedEvent>(KAFKA_TOPICS.GRN_CONFIRMED, payload, payload.warehouseId);
  }

  emitSoConfirmed(payload: WithoutBase<SoConfirmedEvent>) {
    return this.publish<SoConfirmedEvent>(KAFKA_TOPICS.SO_CONFIRMED, payload, payload.warehouseId);
  }

  emitGdnConfirmed(payload: WithoutBase<GdnConfirmedEvent>) {
    return this.publish<GdnConfirmedEvent>(KAFKA_TOPICS.GDN_CONFIRMED, payload, payload.warehouseId);
  }

  emitInvoiceConfirmed(payload: WithoutBase<InvoiceConfirmedEvent>) {
    return this.publish<InvoiceConfirmedEvent>(KAFKA_TOPICS.INVOICE_CONFIRMED, payload, payload.customerId);
  }

  emitInventoryUpdated(payload: WithoutBase<InventoryUpdatedEvent>) {
    return this.publish<InventoryUpdatedEvent>(KAFKA_TOPICS.INVENTORY_UPDATED, payload, payload.warehouseId);
  }

  private publish<T extends object>(topic: string, payload: WithoutBase<T>, partitionKey?: string) {
    const event = {
      ...payload,
      eventId: uuidv4(),
      occurredAt: new Date().toISOString(),
    } as T;

    const key = partitionKey ?? uuidv4();
    this.logger.debug(`Emit → ${topic} [key=${key}]`);

    return this.kafka.emit(topic, { key, value: JSON.stringify(event) });
  }
}
