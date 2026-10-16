import { Injectable, Optional, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { ObservabilityHeartbeat } from '../../infrastructure/observability/heartbeat.service.js';
import { reportError } from '../../infrastructure/observability/error-reporting.js';
import { AuthMailService } from '../../modules/auth/index.js';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service.js';
@Injectable()
export class AuthMailWorkerRunner implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active: Promise<void> | undefined;
  constructor(
    private readonly mail: AuthMailService,
    private readonly logger: StructuredLogger,
    @Optional() private readonly heartbeat?: ObservabilityHeartbeat,
  ) {}
  onModuleInit() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }
  private tick() {
    if (this.active) return;
    this.active = this.mail
      .tick()
      .then(() => this.heartbeat?.completed('auth-mail'))
      .catch((error) => {
        reportError(error, { code: 'WORKER_FAILED', stage: 'worker' });
        this.logger.warn('auth_mail_tick_failed');
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
