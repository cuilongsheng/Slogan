import type { BackofficeRole } from '../../../backoffice/index.js';
import type {
  RecoveryDrillView,
  RetentionCategory,
  RetentionDryRunView,
  RetentionHoldView,
  RetentionPolicyView,
  RetentionRunView,
} from '../entities/operations.js';

export const GOVERNANCE_REPOSITORY = Symbol('GOVERNANCE_REPOSITORY');

export interface GovernanceRepository {
  createPolicy(input: {
    actorUserId: string;
    actorRoles: BackofficeRole[];
    category: RetentionCategory;
    scopeKey: string;
    retentionSeconds: number;
    rationaleRef: string;
    automatic: boolean;
    requestId?: string;
  }): Promise<RetentionPolicyView>;
  activatePolicy(input: {
    actorUserId: string;
    actorRoles: BackofficeRole[];
    policyId: string;
    reason: string;
    requestId?: string;
  }): Promise<RetentionPolicyView>;
  listPolicies(): Promise<RetentionPolicyView[]>;
  createDryRun(input: {
    actorUserId: string;
    actorRoles: BackofficeRole[];
    policyId: string;
    clientRequestId: string;
    payloadHash: string;
    ttlSeconds: number;
    now: Date;
    requestId?: string;
  }): Promise<RetentionDryRunView>;
  createHold(input: {
    actorUserId: string;
    actorRoles: BackofficeRole[];
    category: RetentionCategory;
    targetType?: string;
    targetId?: string;
    startsAt: Date;
    endsAt?: Date;
    reason: string;
    requestId?: string;
  }): Promise<RetentionHoldView>;
  releaseHold(input: {
    actorUserId: string;
    actorRoles: BackofficeRole[];
    holdId: string;
    reason: string;
    requestId?: string;
  }): Promise<RetentionHoldView>;
  listHolds(): Promise<RetentionHoldView[]>;
  createRun(input: {
    actorUserId: string;
    actorRoles: BackofficeRole[];
    dryRunId: string;
    clientRequestId: string;
    payloadHash: string;
    now: Date;
    requestId?: string;
  }): Promise<RetentionRunView>;
  claimRun(leaseSeconds: number, now: Date): Promise<RetentionRunView | null>;
  executeBatch(runId: string, generation: number, batchSize: number, now: Date): Promise<RetentionRunView>;
  listRuns(): Promise<RetentionRunView[]>;
  recordDeletionEvidence(input: {
    category: RetentionCategory;
    purpose: string;
    providerCategory?: string;
    policyVersion: string;
    deadlineAt: Date;
    completedAt?: Date;
    result: 'COMPLETED' | 'UNCERTAIN' | 'FAILED';
    reasonCode?: string;
  }): Promise<void>;
  listDeletionEvidence(): Promise<Record<string, unknown>[]>;
  recordRecoveryDrill(input: {
    actorUserId: string;
    actorRoles: BackofficeRole[];
    clientRequestId: string;
    payloadHash: string;
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
    requestId?: string;
  }): Promise<RecoveryDrillView>;
  listRecoveryDrills(): Promise<RecoveryDrillView[]>;
  health(now: Date): Promise<Record<string, unknown>>;
}
