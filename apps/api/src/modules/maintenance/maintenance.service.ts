import { randomUUID } from 'node:crypto';
import { WorkHintsService } from './work-hints.service.js';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { LiveUpdatesService } from '../live-updates/index.js';
import { ConfigService } from '@nestjs/config';
import {
  WorkerOwner,
  FALLBACK_SECONDS,
  IDLE_FALLBACK_SECONDS,
  type FencedJob,
} from '../../infrastructure/managed/worker-owner.service.js';
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
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<void> | undefined;
  private maintaining: Promise<void> | undefined;
  private readonly pendingKinds = new Set<string>();
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
    private readonly owner: WorkerOwner,
    private readonly hints: WorkHintsService,
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
  async seed(reconcileRooms = false): Promise<void> {
    if (!this.managed) return;
    await this.owner.send(
      'slogan-maintenance',
      { kind: reconcileRooms ? 'room-maintenance' : 'maintenance' },
      {
        retentionSeconds: 604800,
        idempotencyKey: `mutation-${randomUUID()}`,
      },
    );
  }
  private async publishFallback(intervalSeconds = FALLBACK_SECONDS) {
    const target = (Math.floor(Date.now() / (intervalSeconds * 1000)) + 1) * intervalSeconds;
    // Both cadences share quarter-hour keys, merging at each common boundary.
    const window = target / FALLBACK_SECONDS;
    await this.owner.send(
      'slogan-maintenance',
      { kind: 'fallback' },
      {
        retentionSeconds: 604800,
        delaySeconds: Math.max(1, Math.ceil(target - Date.now() / 1000)),
        idempotencyKey: `fallback-${window}`,
      },
      true,
    );
  }
  async process(
    job: FencedJob & {
      kind: string;
      userId?: string;
      generation?: string;
      activateFallback?: boolean;
    },
  ) {
    return this.owner.run(job, () => this.processOwned(job));
  }
  private async processOwned(
    job: FencedJob & {
      kind: string;
      userId?: string;
      generation?: string;
      activateFallback?: boolean;
    },
  ) {
    if (job?.kind === 'presence-expiry') {
      if (
        !job.userId ||
        !/^[-a-f0-9]{36}$/.test(job.userId) ||
        !job.generation ||
        !/^[-a-zA-Z0-9:]{1,128}$/.test(job.generation)
      )
        throw new Error('Invalid presence job');
      const deadline = this.live.presenceExpiry
        ? await this.live.presenceExpiry(job.userId, job.generation)
        : { ttl: await this.live.expirePresence(job.userId, job.generation), expiresAt: 0 };
      const ttl = deadline.ttl;
      if (ttl > 0) {
        if (job.activateFallback) await this.publishFallback();
        await this.owner.send(
          'slogan-maintenance',
          { ...job, activateFallback: false },
          {
            delaySeconds: Math.max(1, Math.ceil(ttl / 1000)),
            idempotencyKey: `presence-${job.userId}-${job.generation}-${deadline.expiresAt}`,
            retentionSeconds: 604800,
          },
        );
      }
      return;
    }
    if (!['maintenance', 'room-maintenance', 'fallback', 'direct-maintenance'].includes(job?.kind))
      throw new Error('Invalid maintenance job');
    this.pendingKinds.add(job.kind);
    this.maintaining ??= Promise.resolve()
      .then(async () => {
        while (this.pendingKinds.size) {
          const kind = this.pendingKinds.has('fallback')
            ? 'fallback'
            : this.pendingKinds.has('room-maintenance')
              ? 'room-maintenance'
              : this.pendingKinds.has('maintenance')
                ? 'maintenance'
                : 'direct-maintenance';
          this.pendingKinds.clear();
          await this.maintain(kind);
        }
      })
      .finally(() => {
        this.maintaining = undefined;
      });
    await this.maintaining;
  }
  private async maintain(kind: string) {
    const hint = await this.hints.read(kind === 'fallback' || kind === 'room-maintenance');
    let online = false;
    if (kind === 'fallback') {
      online = !!(await this.live.sweepPresence());
      // Retain release discovery without a separate timer or per-subscriber poll.
      try {
        if (await this.live.reconcileRelease()) await this.live.recover();
      } catch {
        this.logger.warn('release_metadata_check_pending');
      }
    }
    const operations =
      kind === 'fallback' && this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true });
    const assistance =
      kind === 'fallback' && this.config.get('ASSISTANCE_ENABLED', { infer: true });
    const hasWork = hint.outbox || hint.realtime || hint.direct || hint.safety;
    if (kind === 'fallback' || (hasWork && kind !== 'direct-maintenance'))
      await this.publishFallback(
        online || hasWork || operations || assistance ? FALLBACK_SECONDS : IDLE_FALLBACK_SECONDS,
      );
    if (
      !hint.outbox &&
      !hint.realtime &&
      !hint.direct &&
      !hint.safety &&
      !operations &&
      !assistance
    )
      return;
    const claim = await this.leases.claim('managed-maintenance');
    if (!claim) throw new Error('MAINTENANCE_LEASE_BUSY');
    let success = false;
    try {
      const results = await Promise.allSettled([
        ...(hint.direct ? [this.direct.maintain()] : []),
        ...(hint.outbox ? [this.live.recover()] : []),
        ...(hint.safety ? [this.safety.recover()] : []),
        ...(operations ? [this.operations.runOnce()] : []),
        ...(hint.realtime && kind !== 'direct-maintenance' ? [this.realtime.ensureRecovery()] : []),
        ...(assistance ? [this.assistance.purgeExpired()] : []),
      ]);
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Maintenance recovery pending');
      await this.live.recover();
      if (hint.direct)
        await this.owner.send(
          'slogan-maintenance',
          { kind: 'direct-maintenance' },
          {
            retentionSeconds: 604800,
            delaySeconds: 15,
            idempotencyKey: `direct-${Math.floor(Date.now() / 15000) + 1}`,
          },
        );
      success = true;
    } finally {
      await this.leases.finish(claim, success);
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
    await this.maintaining;
  }
}
