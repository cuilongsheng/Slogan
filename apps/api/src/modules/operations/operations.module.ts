import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BackofficeModule } from '../backoffice/index.js';
import { GovernanceService } from './application/services/governance.service.js';
import { IncidentsService } from './application/services/incidents.service.js';
import { MetricsService } from './application/services/metrics.service.js';
import { OperationsRunnerService } from './application/services/operations-runner.service.js';
import { OperationsProbeService } from './application/services/operations-probe.service.js';
import { OPERATIONS_DEPENDENCY_PROBES } from './domain/ports/dependency-probes.port.js';
import { GOVERNANCE_REPOSITORY } from './domain/ports/governance.repository.js';
import {
  INCIDENTS_REPOSITORY,
  OPERATIONAL_ALERT_SINK,
} from './domain/ports/incidents.repository.js';
import { METRICS_REPOSITORY } from './domain/ports/metrics.repository.js';
import { HttpOperationalAlertSink } from './infrastructure/http-operational-alert-sink.js';
import { NetworkOperationsDependencyProbes } from './infrastructure/operations-dependency-probes.js';
import { PrismaGovernanceRepository } from './infrastructure/prisma-governance.repository.js';
import { PrismaIncidentsRepository } from './infrastructure/prisma-incidents.repository.js';
import { PrismaMetricsRepository } from './infrastructure/prisma-metrics.repository.js';
import { OperationsController } from './presentation/operations.controller.js';

@Module({
  imports: [AuthModule, BackofficeModule],
  controllers: [OperationsController],
  providers: [
    MetricsService,
    IncidentsService,
    GovernanceService,
    OperationsProbeService,
    OperationsRunnerService,
    PrismaMetricsRepository,
    PrismaIncidentsRepository,
    PrismaGovernanceRepository,
    HttpOperationalAlertSink,
    NetworkOperationsDependencyProbes,
    { provide: METRICS_REPOSITORY, useExisting: PrismaMetricsRepository },
    { provide: INCIDENTS_REPOSITORY, useExisting: PrismaIncidentsRepository },
    { provide: GOVERNANCE_REPOSITORY, useExisting: PrismaGovernanceRepository },
    { provide: OPERATIONAL_ALERT_SINK, useExisting: HttpOperationalAlertSink },
    {
      provide: OPERATIONS_DEPENDENCY_PROBES,
      useExisting: NetworkOperationsDependencyProbes,
    },
  ],
  exports: [MetricsService, IncidentsService, GovernanceService, OperationsRunnerService],
})
export class OperationsModule {}
