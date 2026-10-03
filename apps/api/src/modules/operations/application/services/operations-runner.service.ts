import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import { PHONE_CHALLENGE_STORE, type PhoneChallengeStore } from '../../../auth/index.js';
import { GovernanceService } from './governance.service.js';
import { IncidentsService } from './incidents.service.js';
import { MetricsService } from './metrics.service.js';
import { OperationsProbeService } from './operations-probe.service.js';

@Injectable()
export class OperationsRunnerService {
  constructor(
    private readonly metrics: MetricsService,
    private readonly incidents: IncidentsService,
    private readonly governance: GovernanceService,
    private readonly probes: OperationsProbeService,
    private readonly config: ConfigService<Environment, true>,
    @Optional()
    @Inject(PHONE_CHALLENGE_STORE)
    private readonly phoneChallenges?: PhoneChallengeStore,
  ) {}

  async runOnce(now = new Date()) {
    if (!this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true }))
      return { enabled: false };
    const outcomes: Record<string, unknown> = { enabled: true };
    outcomes.dependencies = await this.probes.run(now);
    if (this.config.get('PHONE_AUTH_ENABLED', { infer: true }) && this.phoneChallenges)
      try {
        outcomes.temporaryCoordination = {
          removedOrphans: await this.phoneChallenges.cleanup(),
        };
      } catch {
        outcomes.temporaryCoordination = {
          status: 'degraded',
          reasonCode: 'TEMPORARY_COORDINATION_CLEANUP_FAILED',
        };
        await this.incidents.observe({
          component: 'REDIS',
          category: 'TEMPORARY_COORDINATION',
          severity: 'WARNING',
          scopeType: 'GLOBAL',
          scopeKey: 'phone-auth',
          ruleVersion: 'retention-v1',
          reasonCode: 'TEMPORARY_COORDINATION_CLEANUP_FAILED',
          observedAt: now,
        });
      }
    try {
      outcomes.metrics = await this.metrics.generate(
        'DAY',
        this.metrics.previousWindow('DAY', now),
        now,
      );
    } catch {
      outcomes.metrics = {
        status: 'degraded',
        reasonCode: 'METRIC_RUN_FAILED',
      };
    }
    outcomes.alert = await this.incidents.dispatchOne(now);
    outcomes.retention = await this.governance.dispatchOne(now);
    const health = await this.governance.health();
    outcomes.health = health;
    const components = health.components as {
      alertDelivery?: { failed: number };
      retention?: { pendingOrFailed: number };
      deletionEvidence?: { overdueUncertain: number };
      recovery?: { failed: number };
      commandBacklog?: { overdue: number };
      keywordJobs?: { overdue: number };
      safetyAssignment?: { overdue: number };
      restrictionRecovery?: { overdue: number };
    };
    for (const probe of [
      {
        component: 'ALERT_SINK',
        count: components.alertDelivery?.failed ?? 0,
        reasonCode: 'DELIVERY_BACKLOG',
      },
      {
        component: 'RETENTION',
        count: components.retention?.pendingOrFailed ?? 0,
        reasonCode: 'RETENTION_BACKLOG',
      },
      {
        component: 'DELETION_EVIDENCE',
        count: components.deletionEvidence?.overdueUncertain ?? 0,
        reasonCode: 'DELETION_UNCERTAIN',
      },
      {
        component: 'RECOVERY',
        count: components.recovery?.failed ?? 0,
        reasonCode: 'RECOVERY_FAILED',
      },
      {
        component: 'REALTIME_COMMAND',
        count: components.commandBacklog?.overdue ?? 0,
        reasonCode: 'COMMAND_BACKLOG',
      },
      {
        component: 'POST_ROOM_KEYWORDS',
        count: components.keywordJobs?.overdue ?? 0,
        reasonCode: 'JOB_DEADLINE_EXCEEDED',
      },
      {
        component: 'SAFETY_CASE',
        count: components.safetyAssignment?.overdue ?? 0,
        reasonCode: 'CASE_ASSIGNMENT_DELAYED',
      },
      {
        component: 'SAFETY_RESTRICTION',
        count: components.restrictionRecovery?.overdue ?? 0,
        reasonCode: 'RESTRICTION_RECOVERY_DELAYED',
      },
    ]) {
      if (probe.count < this.config.get('OPERATIONS_INCIDENT_FAILURE_THRESHOLD', { infer: true }))
        continue;
      await this.incidents.observe({
        component: probe.component,
        category: 'READINESS',
        severity: probe.count >= 10 ? 'HIGH' : 'WARNING',
        scopeType: 'GLOBAL',
        scopeKey: 'platform',
        ruleVersion: this.config.get('OPERATIONS_METRIC_DEFINITION_VERSION', { infer: true }),
        reasonCode: probe.reasonCode,
        observedAt: now,
      });
    }
    return outcomes;
  }
}
