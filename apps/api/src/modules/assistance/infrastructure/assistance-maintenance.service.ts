import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import type { Environment } from '../../../config/environment.js';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service.js';
import {
  ASSISTANCE_REPOSITORY,
  type AssistanceRepository,
} from '../domain/ports/assistance.repository.js';
import type { AssistanceMaintenance } from '../domain/ports/assistance-maintenance.port.js';

@Injectable()
export class AssistanceMaintenanceQueue
  implements AssistanceMaintenance, OnModuleInit, OnModuleDestroy
{
  private readonly queue?: Queue<{ requestId: string }>;
  private readonly worker?: Worker<{ requestId: string }>;
  private readonly producer?: Redis;
  private readonly consumer?: Redis;

  constructor(
    config: ConfigService<Environment, true>,
    @Inject(ASSISTANCE_REPOSITORY) private readonly repository: AssistanceRepository,
    private readonly logger: StructuredLogger,
  ) {
    const url = config.get('ASSISTANCE_ENABLED', { infer: true })
      ? config.get('REDIS_URL', { infer: true })
      : undefined;
    if (!url) return;
    this.producer = new Redis(url, { maxRetriesPerRequest: null });
    this.consumer = new Redis(url, { maxRetriesPerRequest: null });
    this.queue = new Queue('assistance-maintenance', { connection: this.producer });
    this.worker = new Worker(
      'assistance-maintenance',
      async (job) => {
        await this.repository.purgeExpired(job.data.requestId);
      },
      { connection: this.consumer, concurrency: 2 },
    );
    this.queue.on('error', () => this.logger.warn('assistance_maintenance_queue_unavailable'));
    this.worker.on('error', () => this.logger.warn('assistance_maintenance_worker_unavailable'));
    this.worker.on('failed', (job) =>
      this.logger.warn({ event: 'assistance_cleanup_failed', jobId: job?.id }),
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.queue) return;
    try {
      await this.repository.purgeExpired();
      for (const item of await this.repository.pendingOutputExpiries())
        await this.scheduleExpiry(item.id, item.outputExpiresAt);
    } catch {
      this.logger.warn('assistance_cleanup_recovery_unavailable');
    }
  }

  async scheduleExpiry(requestId: string, expiresAt: Date): Promise<void> {
    if (!this.queue) return;
    try {
      const jobId = `expire-${requestId}`;
      const existing = await this.queue.getJob(jobId);
      if (existing) await existing.remove();
      await this.queue.add(
        'expire-output',
        { requestId },
        {
          jobId,
          delay: Math.max(0, expiresAt.getTime() - Date.now()),
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch {
      this.logger.warn({ event: 'assistance_cleanup_schedule_unavailable', requestId });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.producer?.disconnect();
    this.consumer?.disconnect();
  }
}
