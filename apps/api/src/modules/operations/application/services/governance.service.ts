import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import type { BackofficeRole } from '../../../backoffice/index.js';
import type { RetentionCategory } from '../../domain/entities/operations.js';
import { OperationsError } from '../../domain/errors/operations.error.js';
import { GOVERNANCE_REPOSITORY, type GovernanceRepository } from '../../domain/ports/governance.repository.js';
import { commandHash } from '../../domain/policies/operations.policy.js';

@Injectable()
export class GovernanceService {
  constructor(
    @Inject(GOVERNANCE_REPOSITORY) private readonly repository: GovernanceRepository,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  policies() { return this.repository.listPolicies(); }
  holds() { return this.repository.listHolds(); }
  runs() { return this.repository.listRuns(); }
  deletionEvidence() { return this.repository.listDeletionEvidence(); }
  recoveryDrills() { return this.repository.listRecoveryDrills(); }
  health() { return this.repository.health(new Date()); }

  createPolicy(actorUserId: string, actorRoles: BackofficeRole[], input: { category: RetentionCategory; scopeKey: string; retentionSeconds: number; rationaleRef: string; automatic: boolean }, requestId?: string) {
    this.assertEnabled();
    return this.repository.createPolicy({ actorUserId, actorRoles, ...input, ...(requestId ? { requestId } : {}) });
  }
  activatePolicy(actorUserId: string, actorRoles: BackofficeRole[], policyId: string, reason: string, requestId?: string) {
    this.assertEnabled();
    return this.repository.activatePolicy({ actorUserId, actorRoles, policyId, reason, ...(requestId ? { requestId } : {}) });
  }
  dryRun(actorUserId: string, actorRoles: BackofficeRole[], policyId: string, clientRequestId: string, requestId?: string) {
    this.assertEnabled();
    return this.repository.createDryRun({ actorUserId, actorRoles, policyId, clientRequestId, payloadHash: commandHash({ policyId }), ttlSeconds: this.config.get('GOVERNANCE_DRY_RUN_TTL_SECONDS', { infer: true }), now: new Date(), ...(requestId ? { requestId } : {}) });
  }
  createHold(actorUserId: string, actorRoles: BackofficeRole[], input: { category: RetentionCategory; targetType?: string; targetId?: string; startsAt: Date; endsAt?: Date; reason: string }, requestId?: string) {
    this.assertEnabled();
    return this.repository.createHold({ actorUserId, actorRoles, ...input, ...(requestId ? { requestId } : {}) });
  }
  releaseHold(actorUserId: string, actorRoles: BackofficeRole[], holdId: string, reason: string, requestId?: string) {
    this.assertEnabled();
    return this.repository.releaseHold({ actorUserId, actorRoles, holdId, reason, ...(requestId ? { requestId } : {}) });
  }
  createRun(actorUserId: string, actorRoles: BackofficeRole[], dryRunId: string, confirmation: string, clientRequestId: string, requestId?: string) {
    this.assertEnabled();
    if (confirmation !== 'DELETE APPROVED RETENTION CANDIDATES') throw OperationsError.invalid();
    return this.repository.createRun({ actorUserId, actorRoles, dryRunId, clientRequestId, payloadHash: commandHash({ dryRunId, confirmation }), now: new Date(), ...(requestId ? { requestId } : {}) });
  }
  recordRecovery(actorUserId: string, actorRoles: BackofficeRole[], input: { clientRequestId: string; environment: 'LOCAL' | 'TARGET'; environmentId: string; backupDigest: string; toolVersion: string; schemaVersion: string; status: 'SUCCEEDED' | 'FAILED'; observedRpoSeconds: number; observedRtoSeconds: number; checkSummary: Record<string, string | number | boolean>; errorCode?: string; startedAt: Date; completedAt: Date }, requestId?: string) {
    this.assertEnabled();
    const payloadHash = commandHash(input);
    return this.repository.recordRecoveryDrill({ actorUserId, actorRoles, ...input, payloadHash, ...(requestId ? { requestId } : {}) });
  }
  recordDeletion(input: Parameters<GovernanceRepository['recordDeletionEvidence']>[0]) { return this.repository.recordDeletionEvidence(input); }

  async dispatchOne(now = new Date()) {
    if (!this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true })) return { handled: false };
    const run = await this.repository.claimRun(this.config.get('GOVERNANCE_LEASE_SECONDS', { infer: true }), now);
    if (!run) return { handled: false };
    const result = await this.repository.executeBatch(run.id, run.generation, this.config.get('GOVERNANCE_RETENTION_BATCH_SIZE', { infer: true }), new Date());
    return { handled: true, run: result };
  }

  private assertEnabled() {
    if (!this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true })) throw OperationsError.unavailable();
  }
}
