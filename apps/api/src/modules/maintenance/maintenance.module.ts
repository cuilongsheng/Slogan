import { Module } from '@nestjs/common';
import { DirectModule } from '../direct/index.js';
import { SafetyModule } from '../safety/index.js';
import { OperationsModule } from '../operations/index.js';
import { AssistanceModule } from '../assistance/index.js';
import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { MaintenanceLease } from '../../infrastructure/managed/maintenance-lease.service.js';
import { MaintenanceService } from './maintenance.service.js';
@Module({
  imports: [
    DirectModule,
    SafetyModule,
    OperationsModule,
    AssistanceModule,
    RedisModule,
    ObservabilityModule,
  ],
  providers: [MaintenanceLease, MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
