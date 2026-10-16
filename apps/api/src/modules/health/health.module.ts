import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { HealthRateLimitGuard } from './health-rate-limit.guard.js';
@Module({ controllers: [HealthController], providers: [HealthService, HealthRateLimitGuard] })
export class HealthModule {}
