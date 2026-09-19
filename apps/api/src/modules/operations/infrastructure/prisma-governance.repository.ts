import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type RecoveryDrill, type RetentionDryRun, type RetentionHold, type RetentionPolicyVersion, type RetentionRun } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { appendBackofficeAuditEvent } from '../../audit/index.js';
import type { RecoveryDrillView, RetentionCategory, RetentionDryRunView, RetentionHoldView, RetentionPolicyView, RetentionRunView } from '../domain/entities/operations.js';
import { OperationsError } from '../domain/errors/operations.error.js';
import type { GovernanceRepository } from '../domain/ports/governance.repository.js';
import { validateRetentionSeconds } from '../domain/policies/operations.policy.js';

type Tx = Prisma.TransactionClient;
const policyView = (row: RetentionPolicyVersion): RetentionPolicyView => ({ ...row, category: row.category });
const dryView = (row: RetentionDryRun): RetentionDryRunView => row;
const holdView = (row: RetentionHold): RetentionHoldView => row;
const runView = (row: RetentionRun): RetentionRunView => row;
const recoveryView = (row: RecoveryDrill): RecoveryDrillView => ({ ...row, checkSummary: row.checkSummary as RecoveryDrillView['checkSummary'] });

@Injectable()
export class PrismaGovernanceRepository implements GovernanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPolicy(input: Parameters<GovernanceRepository['createPolicy']>[0]) {
    validateRetentionSeconds(input.category, input.retentionSeconds);
    if (!input.scopeKey.trim() || !input.rationaleRef.trim()) throw OperationsError.invalid();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.category}:${input.scopeKey}`}, 0))`;
      const last = await tx.retentionPolicyVersion.findFirst({ where: { category: input.category, scopeKey: input.scopeKey }, orderBy: { version: 'desc' }, select: { version: true } });
      const row = await tx.retentionPolicyVersion.create({ data: {
        id: randomUUID(), category: input.category, scopeKey: input.scopeKey.trim(), version: (last?.version ?? 0) + 1,
        retentionSeconds: input.retentionSeconds, rationaleRef: input.rationaleRef.trim(), automatic: input.automatic,
        createdByUserId: input.actorUserId,
      } });
      await appendBackofficeAuditEvent(tx, { actorType: 'USER', actorUserId: input.actorUserId, actorRoles: input.actorRoles, action: 'RETENTION_POLICY_CREATED', targetType: 'RETENTION_POLICY', targetId: row.id, reason: input.rationaleRef.trim(), result: 'SUCCEEDED', ...(input.requestId ? { requestId: input.requestId } : {}), details: { category: input.category, scopeKey: input.scopeKey, version: row.version, automatic: input.automatic } });
      return policyView(row);
    });
  }

  async activatePolicy(input: Parameters<GovernanceRepository['activatePolicy']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.retentionPolicyVersion.findUnique({ where: { id: input.policyId } });
      if (!current) throw OperationsError.notFound();
      validateRetentionSeconds(current.category, current.retentionSeconds);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${current.category}:${current.scopeKey}`}, 0))`;
      await tx.retentionPolicyVersion.updateMany({ where: { category: current.category, scopeKey: current.scopeKey, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } });
      const row = await tx.retentionPolicyVersion.update({ where: { id: current.id }, data: { status: 'ACTIVE', activatedAt: new Date() } });
      await appendBackofficeAuditEvent(tx, { actorType: 'USER', actorUserId: input.actorUserId, actorRoles: input.actorRoles, action: 'RETENTION_POLICY_ACTIVATED', targetType: 'RETENTION_POLICY', targetId: row.id, reason: input.reason, result: 'SUCCEEDED', ...(input.requestId ? { requestId: input.requestId } : {}), details: { category: row.category, scopeKey: row.scopeKey, version: row.version } });
      return policyView(row);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listPolicies() { return (await this.prisma.retentionPolicyVersion.findMany({ orderBy: [{ category: 'asc' }, { scopeKey: 'asc' }, { version: 'desc' }] })).map(policyView); }

  async createDryRun(input: Parameters<GovernanceRepository['createDryRun']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.retentionDryRun.findUnique({ where: { actorUserId_clientRequestId: { actorUserId: input.actorUserId, clientRequestId: input.clientRequestId } } });
      if (replay) {
        if (replay.payloadHash !== input.payloadHash) throw OperationsError.conflict();
        return dryView(replay);
      }
      const policy = await tx.retentionPolicyVersion.findUnique({ where: { id: input.policyId } });
      if (!policy || policy.status !== 'ACTIVE' || policy.retentionSeconds === null) throw OperationsError.conflict('RETENTION_POLICY_NOT_ACTIVE');
      validateRetentionSeconds(policy.category, policy.retentionSeconds);
      const boundary = new Date(input.now.getTime() - policy.retentionSeconds * 1000);
      const summary = await this.candidates(tx, policy.category, boundary);
      const row = await tx.retentionDryRun.create({ data: {
        id: randomUUID(), policyId: policy.id, actorUserId: input.actorUserId, clientRequestId: input.clientRequestId,
        payloadHash: input.payloadHash, boundaryEligibleAt: boundary, candidateCount: summary.count,
        earliestEligibleAt: summary.earliest, latestEligibleAt: summary.latest,
        expiresAt: new Date(input.now.getTime() + input.ttlSeconds * 1000),
      } });
      await appendBackofficeAuditEvent(tx, { actorType: 'USER', actorUserId: input.actorUserId, actorRoles: input.actorRoles, action: 'RETENTION_DRY_RUN_CREATED', targetType: 'RETENTION_DRY_RUN', targetId: row.id, result: 'SUCCEEDED', ...(input.requestId ? { requestId: input.requestId } : {}), clientRequestId: input.clientRequestId, requestHash: input.payloadHash, details: { category: policy.category, candidateCount: row.candidateCount, boundaryEligibleAt: boundary.toISOString() } });
      return dryView(row);
    });
  }

  async createHold(input: Parameters<GovernanceRepository['createHold']>[0]) {
    if ((input.targetType && !input.targetId) || (!input.targetType && input.targetId) || (input.endsAt && input.endsAt <= input.startsAt)) throw OperationsError.invalid();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.retentionHold.create({ data: { id: randomUUID(), category: input.category, targetType: input.targetType ?? null, targetId: input.targetId ?? null, startsAt: input.startsAt, endsAt: input.endsAt ?? null, reason: input.reason, createdByUserId: input.actorUserId } });
      await appendBackofficeAuditEvent(tx, { actorType: 'USER', actorUserId: input.actorUserId, actorRoles: input.actorRoles, action: 'RETENTION_HOLD_CREATED', targetType: 'RETENTION_HOLD', targetId: row.id, reason: input.reason, result: 'SUCCEEDED', ...(input.requestId ? { requestId: input.requestId } : {}), details: { category: input.category, targeted: !!input.targetId } });
      return holdView(row);
    });
  }

  async releaseHold(input: Parameters<GovernanceRepository['releaseHold']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.retentionHold.update({ where: { id: input.holdId }, data: { releasedAt: new Date(), releasedByUserId: input.actorUserId, releaseReason: input.reason } }).catch(() => { throw OperationsError.notFound(); });
      await appendBackofficeAuditEvent(tx, { actorType: 'USER', actorUserId: input.actorUserId, actorRoles: input.actorRoles, action: 'RETENTION_HOLD_RELEASED', targetType: 'RETENTION_HOLD', targetId: row.id, reason: input.reason, result: 'SUCCEEDED', ...(input.requestId ? { requestId: input.requestId } : {}), details: { category: row.category } });
      return holdView(row);
    });
  }
  async listHolds() { return (await this.prisma.retentionHold.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })).map(holdView); }

  async createRun(input: Parameters<GovernanceRepository['createRun']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.retentionRun.findUnique({ where: { actorUserId_clientRequestId: { actorUserId: input.actorUserId, clientRequestId: input.clientRequestId } } });
      if (replay) {
        if (replay.payloadHash !== input.payloadHash) throw OperationsError.conflict();
        return runView(replay);
      }
      const dry = await tx.retentionDryRun.findUnique({ where: { id: input.dryRunId }, include: { policy: true } });
      if (!dry || dry.expiresAt <= input.now || dry.consumedAt || dry.policy.status !== 'ACTIVE') throw OperationsError.conflict('RETENTION_DRY_RUN_INVALID');
      validateRetentionSeconds(dry.policy.category, dry.policy.retentionSeconds);
      const row = await tx.retentionRun.create({ data: { id: randomUUID(), policyId: dry.policyId, dryRunId: dry.id, actorUserId: input.actorUserId, clientRequestId: input.clientRequestId, payloadHash: input.payloadHash } });
      await tx.retentionDryRun.update({ where: { id: dry.id }, data: { consumedAt: input.now } });
      await appendBackofficeAuditEvent(tx, { actorType: 'USER', actorUserId: input.actorUserId, actorRoles: input.actorRoles, action: 'RETENTION_RUN_CREATED', targetType: 'RETENTION_RUN', targetId: row.id, result: 'SUCCEEDED', ...(input.requestId ? { requestId: input.requestId } : {}), clientRequestId: input.clientRequestId, requestHash: input.payloadHash, details: { category: dry.policy.category, dryRunId: dry.id } });
      return runView(row);
    });
  }

  async claimRun(leaseSeconds: number, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "RetentionRun" WHERE status IN ('PENDING','RUNNING') AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now}) ORDER BY "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      const row = await tx.retentionRun.update({ where: { id: rows[0].id }, data: { status: 'RUNNING', generation: { increment: 1 }, leaseId: randomUUID(), lockedUntil: new Date(now.getTime() + leaseSeconds * 1000), startedAt: now } });
      return runView(row);
    });
  }

  async executeBatch(runId: string, generation: number, batchSize: number, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.retentionRun.findUnique({ where: { id: runId }, include: { policy: true } });
      if (!run || run.status !== 'RUNNING' || run.generation !== generation || !run.lockedUntil || run.lockedUntil <= now) throw OperationsError.conflict('RETENTION_RUN_FENCED');
      const hold = await tx.retentionHold.findFirst({ where: { category: run.policy.category, releasedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }], targetId: null } });
      const result = hold ? { scanned: 0, deleted: 0, skipped: batchSize, remaining: false } : await this.deleteBatch(tx, run.policy.category, run.dryRunId, batchSize);
      const sequence = await tx.retentionRunBatch.count({ where: { runId, generation } });
      await tx.retentionRunBatch.create({ data: { id: randomUUID(), runId, generation, sequence: sequence + 1, scannedCount: result.scanned, deletedCount: result.deleted, skippedCount: result.skipped, failedCount: 0 } });
      const completed = !result.remaining;
      const updated = await tx.retentionRun.update({ where: { id: runId }, data: { scannedCount: { increment: result.scanned }, deletedCount: { increment: result.deleted }, skippedCount: { increment: result.skipped }, ...(completed ? { status: 'COMPLETED', completedAt: now, lockedUntil: null } : { lockedUntil: new Date(now.getTime() + 60_000) }) } });
      if (completed) await appendBackofficeAuditEvent(tx, { actorType: 'USER', actorUserId: run.actorUserId, actorRoles: ['PLATFORM_ADMIN'], action: 'RETENTION_RUN_COMPLETED', targetType: 'RETENTION_RUN', targetId: run.id, result: 'SUCCEEDED', details: { category: run.policy.category, deletedCount: updated.deletedCount, skippedCount: updated.skippedCount } });
      return runView(updated);
    });
  }
  async listRuns() { return (await this.prisma.retentionRun.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })).map(runView); }

  async recordDeletionEvidence(input: Parameters<GovernanceRepository['recordDeletionEvidence']>[0]) {
    await this.prisma.deletionEvidence.create({ data: { id: randomUUID(), category: input.category, purpose: input.purpose, providerCategory: input.providerCategory ?? null, policyVersion: input.policyVersion, deadlineAt: input.deadlineAt, completedAt: input.completedAt ?? null, result: input.result, reasonCode: input.reasonCode ?? null } });
  }
  async listDeletionEvidence() { return this.prisma.deletionEvidence.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 }); }

  async recordRecoveryDrill(input: Parameters<GovernanceRepository['recordRecoveryDrill']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.recoveryDrill.findUnique({ where: { actorUserId_clientRequestId: { actorUserId: input.actorUserId, clientRequestId: input.clientRequestId } } });
      if (replay) {
        if (replay.payloadHash !== input.payloadHash) throw OperationsError.conflict();
        return recoveryView(replay);
      }
      const row = await tx.recoveryDrill.create({ data: { id: randomUUID(), actorUserId: input.actorUserId, clientRequestId: input.clientRequestId, payloadHash: input.payloadHash, environment: input.environment, environmentId: input.environmentId, backupDigest: input.backupDigest, toolVersion: input.toolVersion, schemaVersion: input.schemaVersion, status: input.status, observedRpoSeconds: input.observedRpoSeconds, observedRtoSeconds: input.observedRtoSeconds, checkSummary: input.checkSummary, errorCode: input.errorCode ?? null, startedAt: input.startedAt, completedAt: input.completedAt } });
      await appendBackofficeAuditEvent(tx, { actorType: 'USER', actorUserId: input.actorUserId, actorRoles: input.actorRoles, action: 'RECOVERY_DRILL_RECORDED', targetType: 'RECOVERY_DRILL', targetId: row.id, result: input.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'REJECTED', ...(input.requestId ? { requestId: input.requestId } : {}), clientRequestId: input.clientRequestId, requestHash: input.payloadHash, details: { environment: input.environment, environmentId: input.environmentId, status: input.status, observedRpoSeconds: input.observedRpoSeconds, observedRtoSeconds: input.observedRtoSeconds } });
      return recoveryView(row);
    });
  }
  async listRecoveryDrills() { return (await this.prisma.recoveryDrill.findMany({ orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: 100 })).map(recoveryView); }

  async health(now: Date) {
    const [openIncidents, failedDeliveries, pendingRuns, uncertainDeletion, latestMetric, failedDrills] = await Promise.all([
      this.prisma.operationalIncident.count({ where: { status: { not: 'RESOLVED' } } }),
      this.prisma.operationalAlertDelivery.count({ where: { status: 'FAILED' } }),
      this.prisma.retentionRun.count({ where: { status: { in: ['PENDING', 'RUNNING', 'FAILED'] } } }),
      this.prisma.deletionEvidence.count({ where: { result: { in: ['UNCERTAIN', 'FAILED'] }, deadlineAt: { lt: now } } }),
      this.prisma.metricSnapshot.findFirst({ orderBy: { generatedAt: 'desc' }, select: { generatedAt: true } }),
      this.prisma.recoveryDrill.count({ where: { status: 'FAILED' } }),
    ]);
    return { status: 'ok', sampledAt: now, components: { incidents: { open: openIncidents }, alertDelivery: { failed: failedDeliveries }, retention: { pendingOrFailed: pendingRuns }, deletionEvidence: { overdueUncertain: uncertainDeletion }, metrics: { latestGeneratedAt: latestMetric?.generatedAt ?? null }, recovery: { failed: failedDrills } } };
  }

  private async candidates(tx: Tx, category: RetentionCategory, boundary: Date) {
    if (category === 'SHORT_TERM_AI_OUTPUT') {
      const rows = await tx.aiExpressionRequest.aggregate({ where: { output: { not: Prisma.JsonNull }, outputExpiresAt: { lt: boundary }, outputPurgedAt: null }, _count: true, _min: { outputExpiresAt: true }, _max: { outputExpiresAt: true } });
      return { count: rows._count, earliest: rows._min.outputExpiresAt, latest: rows._max.outputExpiresAt };
    }
    if (category === 'OPERATIONS_METRIC') {
      const rows = await tx.metricSnapshot.aggregate({ where: { generatedAt: { lt: boundary } }, _count: true, _min: { generatedAt: true }, _max: { generatedAt: true } });
      return { count: rows._count, earliest: rows._min.generatedAt, latest: rows._max.generatedAt };
    }
    if (category === 'TECHNICAL_COMMAND') {
      const rows = await tx.operationalCommand.aggregate({ where: { createdAt: { lt: boundary } }, _count: true, _min: { createdAt: true }, _max: { createdAt: true } });
      return { count: rows._count, earliest: rows._min.createdAt, latest: rows._max.createdAt };
    }
    return { count: 0, earliest: null, latest: null };
  }

  private async deleteBatch(tx: Tx, category: RetentionCategory, dryRunId: string, batchSize: number) {
    const dry = await tx.retentionDryRun.findUniqueOrThrow({ where: { id: dryRunId } });
    if (category === 'SHORT_TERM_AI_OUTPUT') {
      const rows = await tx.aiExpressionRequest.findMany({ where: { output: { not: Prisma.JsonNull }, outputExpiresAt: { lt: dry.boundaryEligibleAt }, outputPurgedAt: null }, orderBy: [{ outputExpiresAt: 'asc' }, { id: 'asc' }], take: batchSize, select: { id: true } });
      if (rows.length) await tx.aiExpressionRequest.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { output: Prisma.JsonNull, outputPurgedAt: new Date() } });
      const remaining = await tx.aiExpressionRequest.count({ where: { output: { not: Prisma.JsonNull }, outputExpiresAt: { lt: dry.boundaryEligibleAt }, outputPurgedAt: null } });
      return { scanned: rows.length, deleted: rows.length, skipped: 0, remaining: remaining > 0 };
    }
    if (category === 'OPERATIONS_METRIC') {
      const rows = await tx.metricSnapshot.findMany({ where: { generatedAt: { lt: dry.boundaryEligibleAt } }, orderBy: [{ generatedAt: 'asc' }, { id: 'asc' }], take: batchSize, select: { id: true } });
      if (rows.length) await tx.metricSnapshot.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      const remaining = await tx.metricSnapshot.count({ where: { generatedAt: { lt: dry.boundaryEligibleAt } } });
      return { scanned: rows.length, deleted: rows.length, skipped: 0, remaining: remaining > 0 };
    }
    if (category === 'TECHNICAL_COMMAND') {
      const rows = await tx.operationalCommand.findMany({ where: { createdAt: { lt: dry.boundaryEligibleAt } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: batchSize, select: { id: true } });
      if (rows.length) await tx.operationalCommand.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      const remaining = await tx.operationalCommand.count({ where: { createdAt: { lt: dry.boundaryEligibleAt } } });
      return { scanned: rows.length, deleted: rows.length, skipped: 0, remaining: remaining > 0 };
    }
    return { scanned: 0, deleted: 0, skipped: 0, remaining: false };
  }
}
