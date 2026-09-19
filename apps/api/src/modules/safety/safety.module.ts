import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { BackofficeModule } from '../backoffice/index.js';
import { SafetyService } from './application/services/safety.service.js';
import { SAFETY_REPOSITORY } from './domain/ports/safety.repository.js';
import { PrismaSafetyRepository } from './infrastructure/prisma-safety.repository.js';
import { SafetyQueue } from './infrastructure/safety-queue.service.js';
import { SafetyRunner } from './infrastructure/safety-runner.service.js';
import { MeSafetyController } from './presentation/me-safety.controller.js';
import { SafetyBackofficeController } from './presentation/safety-backoffice.controller.js';

@Module({
  imports: [BackofficeModule, ObservabilityModule],
  controllers: [SafetyBackofficeController, MeSafetyController],
  providers: [
    SafetyService,
    SafetyQueue,
    SafetyRunner,
    PrismaSafetyRepository,
    { provide: SAFETY_REPOSITORY, useExisting: PrismaSafetyRepository },
  ],
  exports: [SafetyService],
})
export class SafetyModule {}
