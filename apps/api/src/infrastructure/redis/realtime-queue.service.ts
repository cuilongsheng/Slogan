import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueClient } from '@vercel/queue';
import type { Environment } from '../../config/environment.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';

export interface RealtimeJob {
  kind:
    | 'expiry'
    | 'command'
    | 'host-timeout'
    | 'appointment-open'
    | 'appointment-start-window'
    | 'recovery';
  id: string;
}
@Injectable()
export class RealtimeQueue implements OnModuleDestroy {
  private queue: Queue<RealtimeJob> | undefined;
  private worker: Worker<RealtimeJob> | undefined;
  private producer: Redis | undefined;
  private consumer: Redis | undefined;
  private vercel: QueueClient | undefined;
  private handler: ((job: RealtimeJob) => Promise<void>) | undefined;
  get managed() {
    return process.env.VERCEL === '1';
  }
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {}
  async start(handler: (job: RealtimeJob) => Promise<void>) {
    this.handler = handler;
    if (this.managed) {
      this.vercel = new QueueClient();
      return;
    }
    const url = this.config.get('REDIS_URL', { infer: true });
    if (!url) return;
    this.producer = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      enableOfflineQueue: false,
    });
    this.consumer = new Redis(url, { maxRetriesPerRequest: null, connectTimeout: 5000 });
    for (const redis of [this.producer, this.consumer])
      redis.on('error', () => this.logger.warn('realtime_redis_unavailable'));
    this.queue = new Queue<RealtimeJob>('slogan-realtime', { connection: this.producer });
    this.worker = new Worker<RealtimeJob>('slogan-realtime', async (job) => handler(job.data), {
      connection: this.consumer,
      concurrency: 4,
    });
    this.queue.on('error', () => this.logger.warn('realtime_queue_unavailable'));
    this.worker.on('error', () => this.logger.warn('realtime_worker_unavailable'));
    this.worker.on('failed', (job) =>
      this.logger.warn({ event: 'realtime_job_failed', jobId: job?.id }),
    );
    // Connectivity recovery is asynchronous; durable PostgreSQL state remains the scheduling source.
  }
  async enqueue(job: RealtimeJob, runAt = new Date()) {
    if (this.vercel) {
      const delaySeconds = Math.max(
        0,
        Math.min(604799, Math.ceil((runAt.getTime() - Date.now()) / 1000)),
      );
      await this.vercel.send('slogan-realtime', job, {
        retentionSeconds: 604800,
        delaySeconds,
        idempotencyKey: `${job.kind}-${job.id}-${job.kind === 'recovery' ? Math.floor(runAt.getTime() / 30000) : runAt.getTime()}`,
      });
      return;
    }
    if (!this.queue) return;
    const jobId = `${job.kind}-${job.id}-${job.kind !== 'command' ? runAt.getTime() : 'retry'}`;
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
  async process(job: RealtimeJob) {
    if (!this.handler) throw new Error('Realtime queue not initialized');
    if (
      !job ||
      ![
        'expiry',
        'command',
        'host-timeout',
        'appointment-open',
        'appointment-start-window',
        'recovery',
      ].includes(job.kind) ||
      typeof job.id !== 'string'
    )
      throw new Error('Invalid realtime queue job');
    await this.handler(job);
  }
  async ensureRecovery(delaySeconds = 0) {
    if (!this.managed) return;
    await this.enqueue(
      { kind: 'recovery', id: 'scan' },
      new Date(Date.now() + delaySeconds * 1000),
    );
  }
  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    this.producer?.disconnect();
    this.consumer?.disconnect();
  }
}
