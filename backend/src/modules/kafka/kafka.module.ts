import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaProducerService } from './kafka.producer.service';
import { InventoryConsumer } from './consumers/inventory.consumer';
import { OrdersConsumer } from './consumers/orders.consumer';

export const KAFKA_CLIENT = 'KAFKA_CLIENT';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KAFKA_CLIENT,
        imports: [ConfigModule],
        useFactory: (cfg: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'wsms-producer',
              brokers: cfg.get<string>('KAFKA_BROKERS', 'localhost:9092').split(','),
            },
            producer: {
              allowAutoTopicCreation: false,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [KafkaProducerService, InventoryConsumer, OrdersConsumer],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
