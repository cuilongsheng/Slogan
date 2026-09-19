import { Module } from '@nestjs/common';

import { AiProviderModule } from '../../infrastructure/ai/ai-provider.module.js';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { SttProviderModule } from '../../infrastructure/stt/stt-provider.module.js';
import { RoomsModule } from '../rooms/index.js';
import { AssistanceService } from './application/services/assistance.service.js';
import { ASSISTANCE_MAINTENANCE } from './domain/ports/assistance-maintenance.port.js';
import { ASSISTANCE_REPOSITORY } from './domain/ports/assistance.repository.js';
import { AssistancePolicy } from './domain/policies/assistance.policy.js';
import { AssistanceMaintenanceQueue } from './infrastructure/assistance-maintenance.service.js';
import { PrismaAssistanceRepository } from './infrastructure/prisma-assistance.repository.js';
import { AssistanceController } from './presentation/assistance.controller.js';

@Module({
  imports: [RoomsModule, RedisModule, AiProviderModule, SttProviderModule, ObservabilityModule],
  controllers: [AssistanceController],
  providers: [
    AssistanceService,
    AssistancePolicy,
    PrismaAssistanceRepository,
    { provide: ASSISTANCE_REPOSITORY, useExisting: PrismaAssistanceRepository },
    AssistanceMaintenanceQueue,
    { provide: ASSISTANCE_MAINTENANCE, useExisting: AssistanceMaintenanceQueue },
  ],
  exports: [AssistanceService],
})
export class AssistanceModule {}
