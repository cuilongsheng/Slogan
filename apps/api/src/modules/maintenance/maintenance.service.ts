import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { LiveUpdatesService } from '../live-updates/index.js';
import { ConfigService } from '@nestjs/config';
import { QueueClient } from '@vercel/queue';
import type { Environment } from '../../config/environment.js';
import { MaintenanceLease } from '../../infrastructure/managed/maintenance-lease.service.js';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service.js';
import { DirectService } from '../direct/index.js';
import { SafetyRunner } from '../safety/index.js';
import { OperationsRunnerService } from '../operations/index.js';
import { AssistanceService } from '../assistance/index.js';
import { RealtimeQueue } from '../../infrastructure/redis/realtime-queue.service.js';

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly queue = new QueueClient();
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<void> | undefined;
  private lastSeedAt = 0;
  private seeding: Promise<void> | undefined;
  constructor(
    private readonly direct: DirectService,
    private readonly safety: SafetyRunner,
    private readonly operations: OperationsRunnerService,
    private readonly assistance: AssistanceService,
    private readonly realtime: RealtimeQueue,
    private readonly leases: MaintenanceLease,
    private readonly config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
    private readonly live: LiveUpdatesService,
  ) {}
  get managed() {
    return process.env.VERCEL === '1';
  }
  get production() {
    return !this.managed || process.env.VERCEL_ENV === 'production';
  }
  onModuleInit() {
    if (this.managed || this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = this.direct
        .maintain()
        .then(() => this.live.reconcileRelease())
        .then(() => this.live.recover())
        .then(() => undefined)
        .catch(() => this.logger.warn('direct_maintenance_pending'))
        .finally(() => {
          this.running = undefined;
        });
    }, 15_000);
    this.timer.unref();
  }
  seed(): Promise<void> {
    if (!this.managed || !this.production) return Promise.resolve();
    if (this.seeding) return this.seeding;
    if (Date.now() - this.lastSeedAt < 60_000) return Promise.resolve();
    this.seeding = this.publish(0)
      .then(() => {
        this.lastSeedAt = Date.now();
      })
      .finally(() => {
        this.seeding = undefined;
      });
    return this.seeding;
  }
  private async publish(delaySeconds: number) {
    const bucket = Math.floor((Date.now() + delaySeconds * 1000) / 60_000);
    await this.queue.send(
      'slogan-maintenance',
      { kind: 'maintenance' },
      { retentionSeconds: 604800, delaySeconds, idempotencyKey: `maintenance-${bucket}` },
    );
  }
  async process(job: { kind: string; userId?: string; generation?: string }) {
    if (!this.production) return;
    if (job?.kind === 'presence-expiry') {
      if (
        !job.userId ||
        !/^[-a-f0-9]{36}$/.test(job.userId) ||
        !job.generation ||
        !/^[-a-f0-9]{36}$/.test(job.generation)
      )
        throw new Error('Invalid presence job');
      const ttl = await this.live.expirePresence(job.userId, job.generation);
      if (ttl > 0)
        await this.queue.send('slogan-maintenance', job, {
          delaySeconds: Math.max(1, Math.ceil(ttl / 1000)),
          retentionSeconds: 604800,
        });
      return;
    }
    if (job?.kind !== 'maintenance') throw new Error('Invalid maintenance job');
    // Publish the continuation before acknowledging this delivery. A failed publish must retry.
    await this.publish(60);
    const claim = await this.leases.claim('managed-maintenance');
    if (!claim) return;
    let success = false;
    try {
      const results = await Promise.allSettled([
        this.direct.maintain(),
        this.live.recover(),
        this.live.reconcileRelease(),
        this.safety.recover(),
        this.operations.runOnce(),
        this.realtime.ensureRecovery(),
        ...(this.config.get('ASSISTANCE_ENABLED', { infer: true })
          ? [this.assistance.purgeExpired()]
          : []),
      ]);
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Maintenance recovery pending');
      await this.live.recover();
      success = true;
    } finally {
      await this.leases.finish(claim, success);
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
