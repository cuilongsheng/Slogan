import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment.js';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service.js';
import { OperationsRunnerService } from '../../modules/operations/index.js';

@Injectable()
export class OperationsWorkerRunner implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active: Promise<void> | undefined;
  constructor(
    private readonly runner: OperationsRunnerService,
    private readonly config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {}
  onModuleInit() {
    if (!this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true })) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), 60_000);
    this.timer.unref();
  }
  private tick() {
    if (this.active) return;
    this.active = this.runner
      .runOnce()
      .then(() => undefined)
      .catch(() => this.logger.warn('operations_runner_failed'))
      .finally(() => {
        this.active = undefined;
      });
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
