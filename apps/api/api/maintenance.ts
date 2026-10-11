import { NestFactory } from '@nestjs/core';
import { QueueClient } from '@vercel/queue';
import { AppModule } from '../src/app.module.js';
import { MaintenanceService } from '../src/modules/maintenance/index.js';
let context: Promise<MaintenanceService> | undefined;
function consumer() {
  context ??= NestFactory.createApplicationContext(AppModule)
    .then((app) => app.get(MaintenanceService))
    .catch((error) => {
      context = undefined;
      throw error;
    });
  return context;
}
export default new QueueClient().handleNodeCallback<{ kind: string }>(
  async (job) => {
    await (await consumer()).process(job);
  },
  {
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(300, 2 ** Math.min(metadata.deliveryCount, 8)),
    }),
  },
);
