import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import type { BackofficeRole } from '../../../backoffice/index.js';
import type { RetentionCategory } from '../../domain/entities/operations.js';
import type { GovernancePageQuery } from '../../domain/entities/operations.js';
import { OperationsError } from '../../domain/errors/operations.error.js';
import {
  GOVERNANCE_REPOSITORY,
  type GovernanceRepository,
} from '../../domain/ports/governance.repository.js';
import {
  commandHash,
  normalizeReason,
  normalizeRecoveryCheckSummary,
  validateRetentionSeconds,
} from '../../domain/policies/operations.policy.js';
import { IncidentsService } from './incidents.service.js';

@Injectable()
export class GovernanceService {
  constructor(
    @Inject(GOVERNANCE_REPOSITORY) private readonly repository: GovernanceRepository,
    private readonly config: ConfigService<Environment, true>,
    private readonly incidents: IncidentsService,
  ) {}

  policies(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    return this.repository.listPolicies(actorUserId, actorRoles, query, requestId);
  }
  dryRuns(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    return this.repository.listDryRuns(actorUserId, actorRoles, query, requestId);
  }
  holds(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    return this.repository.listHolds(actorUserId, actorRoles, query, requestId);
  }
  runs(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    return this.repository.listRuns(actorUserId, actorRoles, query, requestId);
  }
  deletionEvidence(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    return this.repository.listDeletionEvidence(actorUserId, actorRoles, query, requestId);
  }
  recoveryDrills(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    return this.repository.listRecoveryDrills(actorUserId, actorRoles, query, requestId);
  }
  async health() {
    const health = await this.repository.health(new Date());
    const alertSinkConfigured = Boolean(
      this.config.get('OPERATIONS_ALERT_SINK_URL', { infer: true }) &&
      this.config.get('OPERATIONS_ALERT_SINK_TOKEN', { infer: true }),
    );
    const backupPolicyConfigured = Boolean(
      this.config.get('BACKUP_ENVIRONMENT_ID', { infer: true }) &&
      this.config.get('BACKUP_ENCRYPTION_KEY_ID', { infer: true }) &&
      this.config.get('BACKUP_RETENTION_COUNT', { infer: true }) &&
      this.config.get('BACKUP_RPO_SECONDS', { infer: true }) &&
      this.config.get('BACKUP_RTO_SECONDS', { infer: true }),
    );
    return {
      ...health,
      status:
        health.status === 'degraded' || !alertSinkConfigured || !backupPolicyConfigured
          ? 'degraded'
          : 'ok',
      components: {
        ...(health.components as Record<string, unknown>),
        alertSinkConfiguration: { configured: alertSinkConfigured },
        backupPolicy: { configured: backupPolicyConfigured },
      },
    };
  }

  async createPolicy(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    input: {
      category: RetentionCategory;
      scopeKey: string;
      retentionSeconds: number;
      rationaleRef: string;
      automatic: boolean;
    },
    requestId?: string,
  ) {
    this.assertEnabled();
    try {
      validateRetentionSeconds(input.category, input.retentionSeconds);
    } catch (error) {
      const reasonCode =
        error instanceof Error ? error.message.slice(0, 64) : 'RETENTION_POLICY_INVALID';
      await this.repository.recordPolicyRejection({
        actorUserId,
        actorRoles,
        category: input.category,
        reasonCode,
        ...(requestId ? { requestId } : {}),
      });
      if (reasonCode === 'RETENTION_CATEGORY_PROTECTED') throw OperationsError.conflict(reasonCode);
      throw OperationsError.invalid();
    }
    return this.repository.createPolicy({
      actorUserId,
      actorRoles,
      ...input,
      ...(requestId ? { requestId } : {}),
    });
  }
  activatePolicy(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    policyId: string,
    reason: string,
    requestId?: string,
  ) {
    this.assertEnabled();
    const normalizedReason = this.reason(reason);
    return this.repository.activatePolicy({
      actorUserId,
      actorRoles,
      policyId,
      reason: normalizedReason,
      ...(requestId ? { requestId } : {}),
    });
  }
  dryRun(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    policyId: string,
    clientRequestId: string,
    requestId?: string,
  ) {
    this.assertEnabled();
    return this.repository.createDryRun({
      actorUserId,
      actorRoles,
      policyId,
      clientRequestId,
      payloadHash: commandHash({ policyId }),
      ttlSeconds: this.config.get('GOVERNANCE_DRY_RUN_TTL_SECONDS', { infer: true }),
      now: new Date(),
      ...(requestId ? { requestId } : {}),
    });
  }
  createHold(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    input: {
      category: RetentionCategory;
      targetType?: string;
      targetId?: string;
      startsAt: Date;
      endsAt?: Date;
      reason: string;
    },
    requestId?: string,
  ) {
    this.assertEnabled();
    const reason = this.reason(input.reason);
    return this.repository.createHold({
      actorUserId,
      actorRoles,
      ...input,
      reason,
      ...(requestId ? { requestId } : {}),
    });
  }
  releaseHold(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    holdId: string,
    reason: string,
    requestId?: string,
  ) {
    this.assertEnabled();
    const normalizedReason = this.reason(reason);
    return this.repository.releaseHold({
      actorUserId,
      actorRoles,
      holdId,
      reason: normalizedReason,
      ...(requestId ? { requestId } : {}),
    });
  }
  createRun(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    dryRunId: string,
    confirmation: string,
    clientRequestId: string,
    requestId?: string,
  ) {
    this.assertEnabled();
    if (confirmation !== 'DELETE APPROVED RETENTION CANDIDATES') throw OperationsError.invalid();
    return this.repository.createRun({
      actorUserId,
      actorRoles,
      dryRunId,
      clientRequestId,
      payloadHash: commandHash({ dryRunId, confirmation }),
      now: new Date(),
      ...(requestId ? { requestId } : {}),
    });
  }
  recordRecovery(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    input: {
      clientRequestId: string;
      environment: 'LOCAL' | 'TARGET';
      environmentId: string;
      backupDigest: string;
      toolVersion: string;
      schemaVersion: string;
      status: 'SUCCEEDED' | 'FAILED';
      observedRpoSeconds: number;
      observedRtoSeconds: number;
      checkSummary: Record<string, string | number | boolean>;
      errorCode?: string;
      startedAt: Date;
      completedAt: Date;
    },
    requestId?: string,
  ) {
    this.assertEnabled();
    let checkSummary: Record<string, string | number | boolean>;
    try {
      checkSummary = normalizeRecoveryCheckSummary(input.checkSummary);
    } catch {
      throw OperationsError.invalid();
    }
    const normalized = { ...input, checkSummary };
    const payloadHash = commandHash(normalized);
    return this.repository.recordRecoveryDrill({
      actorUserId,
      actorRoles,
      ...normalized,
      payloadHash,
      ...(requestId ? { requestId } : {}),
    });
  }
  async recordDeletion(input: Parameters<GovernanceRepository['recordDeletionEvidence']>[0]) {
    await this.repository.recordDeletionEvidence(input);
    if (
      input.result !== 'COMPLETED' &&
      this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true })
    )
      await this.incidents.observe({
        component: 'DELETION_EVIDENCE',
        category: 'PROVIDER_DELETION',
        severity: input.deadlineAt <= new Date() ? 'HIGH' : 'WARNING',
        scopeType: 'PROVIDER_CATEGORY',
        scopeKey: input.providerCategory ?? 'platform',
        ruleVersion: input.policyVersion,
        reasonCode: input.reasonCode ?? 'PROVIDER_DELETION_UNCERTAIN',
        observedAt: new Date(),
      });
  }

  async dispatchOne(now = new Date()) {
    if (!this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true }))
      return { handled: false };
    const scheduled = await this.repository.scheduleAutomaticRuns(
      now,
      this.config.get('GOVERNANCE_DRY_RUN_TTL_SECONDS', { infer: true }),
    );
    const run = await this.repository.claimRun(
      this.config.get('GOVERNANCE_LEASE_SECONDS', { infer: true }),
      now,
    );
    if (!run) return { handled: false, scheduled };
    try {
      const result = await this.repository.executeBatch(
        run.id,
        run.generation,
        this.config.get('GOVERNANCE_RETENTION_BATCH_SIZE', { infer: true }),
        new Date(),
      );
      return { handled: true, scheduled, run: result };
    } catch (error) {
      const errorCode = error instanceof OperationsError ? error.code : 'RETENTION_BATCH_FAILED';
      await this.repository.failRun(run.id, run.generation, errorCode, now);
      await this.incidents.observe({
        component: 'RETENTION',
        category: 'BATCH_FAILURE',
        severity: 'HIGH',
        scopeType: 'RUN',
        scopeKey: run.id,
        ruleVersion: 'retention-v1',
        reasonCode: 'RETENTION_BATCH_FAILED',
        observedAt: now,
      });
      throw error;
    }
  }

  private assertEnabled() {
    if (!this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true }))
      throw OperationsError.unavailable();
  }

  private reason(value: string): string {
    try {
      return normalizeReason(value);
    } catch {
      throw OperationsError.invalid();
    }
  }
}
