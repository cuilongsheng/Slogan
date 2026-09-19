import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { Environment } from '../../../config/environment.js';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service.js';

export interface SafetyJob {
  kind: 'restriction-expiry' | 'assignment-recovery';
  id: string;
}

@Injectable()
export class SafetyQueue implements OnModuleDestroy {
  private queue: Queue<SafetyJob> | undefined;
  private worker: Worker<SafetyJob> | undefined;
  private producer: Redis | undefined;
  private consumer: Redis | undefined;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {}

  async start(handler: (job: SafetyJob) => Promise<void>) {
    const url = this.config.get('REDIS_URL', { infer: true });
    if (!url) return;
    this.producer = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      enableOfflineQueue: false,
    });
    this.consumer = new Redis(url, { maxRetriesPerRequest: null, connectTimeout: 5000 });
    for (const redis of [this.producer, this.consumer])
      redis.on('error', () => this.logger.warn('safety_redis_unavailable'));
    this.queue = new Queue<SafetyJob>('slogan-safety', { connection: this.producer });
    this.worker = new Worker<SafetyJob>('slogan-safety', async (job) => handler(job.data), {
      connection: this.consumer,
      concurrency: 4,
    });
    this.queue.on('error', () => this.logger.warn('safety_queue_unavailable'));
    this.worker.on('error', () => this.logger.warn('safety_worker_unavailable'));
    this.worker.on('failed', (job) =>
      this.logger.warn({ event: 'safety_job_failed', jobId: job?.id }),
    );
  }

  async enqueue(job: SafetyJob, runAt = new Date()) {
    if (!this.queue) return;
    const jobId = `${job.kind}-${job.id}-${runAt.getTime()}`;
    const existing = await this.queue.getJob(jobId);
    if (existing && (await existing.getState()) === 'failed') await existing.remove();
    await this.queue.add(job.kind, job, {
      jobId,
      delay: Math.max(0, runAt.getTime() - Date.now()),
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    this.producer?.disconnect();
    this.consumer?.disconnect();
  }
}
