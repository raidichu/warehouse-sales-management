import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { ConsumerAppModule } from './consumer-app.module';

async function bootstrap() {
  const logger = new Logger('KafkaConsumer');
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  const groupId = process.env.KAFKA_GROUP_ID ?? 'wsms-consumers';

  // HOSTNAME is set by Docker to the container short ID → unique clientId per instance
  const clientId = `wsms-consumer-${process.env.HOSTNAME ?? 'local'}`;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(ConsumerAppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId,
        brokers,
        retry: {
          initialRetryTime: 300,
          retries: 8,
        },
      },
      consumer: {
        groupId,
        allowAutoTopicCreation: false,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      },
      run: {
        autoCommit: false,
      },
      subscribe: {
        fromBeginning: false,
      },
    },
  });

  await app.listen();
  logger.log(`Kafka consumer started — clientId: ${clientId}, groupId: ${groupId}`);
}

bootstrap();
