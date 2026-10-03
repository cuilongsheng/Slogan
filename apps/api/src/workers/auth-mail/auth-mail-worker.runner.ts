import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment.js';
import { AuthMailService } from '../../modules/auth/index.js';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service.js';
@Injectable()
export class AuthMailWorkerRunner implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active: Promise<void> | undefined;
  constructor(
    private readonly mail: AuthMailService,
    private readonly config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {}
  onModuleInit() {
    if (!this.config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true })) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }
  private tick() {
    if (this.active) return;
    this.active = this.mail
      .tick()
      .then(() => undefined)
      .catch(() => this.logger.warn('auth_mail_tick_failed'))
      .finally(() => {
        this.active = undefined;
      });
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
