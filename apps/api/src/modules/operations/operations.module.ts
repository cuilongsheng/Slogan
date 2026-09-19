import { Module } from '@nestjs/common';
import { BackofficeModule } from '../backoffice/index.js';
import { GovernanceService } from './application/services/governance.service.js';
import { IncidentsService } from './application/services/incidents.service.js';
import { MetricsService } from './application/services/metrics.service.js';
import { OperationsRunnerService } from './application/services/operations-runner.service.js';
import { GOVERNANCE_REPOSITORY } from './domain/ports/governance.repository.js';
import { INCIDENTS_REPOSITORY, OPERATIONAL_ALERT_SINK } from './domain/ports/incidents.repository.js';
import { METRICS_REPOSITORY } from './domain/ports/metrics.repository.js';
import { HttpOperationalAlertSink } from './infrastructure/http-operational-alert-sink.js';
import { PrismaGovernanceRepository } from './infrastructure/prisma-governance.repository.js';
import { PrismaIncidentsRepository } from './infrastructure/prisma-incidents.repository.js';
import { PrismaMetricsRepository } from './infrastructure/prisma-metrics.repository.js';
import { OperationsController } from './presentation/operations.controller.js';

@Module({
  imports: [BackofficeModule],
  controllers: [OperationsController],
  providers: [
    MetricsService, IncidentsService, GovernanceService, OperationsRunnerService,
    PrismaMetricsRepository, PrismaIncidentsRepository, PrismaGovernanceRepository, HttpOperationalAlertSink,
    { provide: METRICS_REPOSITORY, useExisting: PrismaMetricsRepository },
    { provide: INCIDENTS_REPOSITORY, useExisting: PrismaIncidentsRepository },
    { provide: GOVERNANCE_REPOSITORY, useExisting: PrismaGovernanceRepository },
    { provide: OPERATIONAL_ALERT_SINK, useExisting: HttpOperationalAlertSink },
  ],
  exports: [MetricsService, IncidentsService, GovernanceService, OperationsRunnerService],
})
export class OperationsModule {}
