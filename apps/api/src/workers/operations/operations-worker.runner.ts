import { Injectable, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ObservabilityHeartbeat } from '../../infrastructure/observability/heartbeat.service.js';
import { reportError } from '../../infrastructure/observability/error-reporting.js';
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
    @Optional() private readonly heartbeat?: ObservabilityHeartbeat,
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
      .then(() => this.heartbeat?.completed('operations'))
      .catch((error) => {
        reportError(error, { code: 'WORKER_FAILED', stage: 'worker' });
        this.logger.warn('operations_runner_failed');
      })
      .finally(() => {
        this.active = undefined;
      });
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
