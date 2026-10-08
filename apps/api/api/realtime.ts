import { NestFactory } from '@nestjs/core';
import { QueueClient } from '@vercel/queue';
import { AppModule } from '../src/app.module.js';
import {
  RealtimeQueue,
  type RealtimeJob,
} from '../src/infrastructure/redis/realtime-queue.service.js';

// A queue-triggered function is private on Vercel. Keep it separate from the public Nest API.
let context: Promise<RealtimeQueue> | undefined;
function consumer() {
  context ??= NestFactory.createApplicationContext(AppModule)
    .then((app) => app.get(RealtimeQueue))
    .catch((error) => {
      context = undefined;
      throw error;
    });
  return context;
}
const queue = new QueueClient();
export default queue.handleNodeCallback<RealtimeJob>(
  async (job) => {
    await (await consumer()).process(job);
  },
  {
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(300, 2 ** Math.min(metadata.deliveryCount, 8)),
    }),
  },
);
