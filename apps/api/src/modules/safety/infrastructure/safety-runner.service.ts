import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service.js';
import { SAFETY_REPOSITORY, type SafetyRepository } from '../domain/ports/safety.repository.js';
import { SafetyQueue } from './safety-queue.service.js';

@Injectable()
export class SafetyRunner implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | undefined;
  constructor(
    private readonly queue: SafetyQueue,
    @Inject(SAFETY_REPOSITORY) private readonly repository: SafetyRepository,
    private readonly logger: StructuredLogger,
  ) {}
  async onModuleInit() {
    await this.queue.start(async (job) => {
      if (job.kind === 'restriction-expiry') await this.repository.expire(job.id);
      else await this.repository.recoverAssignments();
    });
    this.tick();
    this.timer = setInterval(() => this.tick(), 15_000);
    this.timer.unref();
  }
  private tick() {
    if (this.running) return;
    this.running = this.recover()
      .catch(() => this.logger.warn('safety_recovery_unavailable'))
      .finally(() => {
        this.running = undefined;
      });
  }
  async recover() {
    await this.repository.recoverAssignments();
    for (const restriction of await this.repository.recoverableRestrictionIds()) {
      try {
        if (restriction.endsAt <= new Date()) await this.repository.expire(restriction.id);
        else
          await this.queue.enqueue(
            { kind: 'restriction-expiry', id: restriction.id },
            restriction.endsAt,
          );
      } catch {
        this.logger.warn({
          event: 'safety_restriction_recovery_pending',
          restrictionId: restriction.id,
        });
      }
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
