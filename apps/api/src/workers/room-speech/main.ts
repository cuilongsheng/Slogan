import { NestFactory } from '@nestjs/core';
import { RoomSpeechWorkerModule } from './room-speech-worker.module.js';

async function bootstrap() {
  const context = await NestFactory.createApplicationContext(RoomSpeechWorkerModule, {
    bufferLogs: true,
  });
  context.enableShutdownHooks();
}

void bootstrap();
