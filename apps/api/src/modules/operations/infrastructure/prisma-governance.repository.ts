import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type DeletionEvidence,
  type RecoveryDrill,
  type RetentionDryRun,
  type RetentionHold,
  type RetentionPolicyVersion,
  type RetentionRun,
} from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { appendBackofficeAuditEvent } from '../../audit/index.js';
import type {
  DeletionEvidenceView,
  GovernancePage,
  GovernancePageQuery,
  RecoveryDrillView,
  RetentionCategory,
  RetentionDryRunView,
  RetentionHoldView,
  RetentionPolicyView,
  RetentionRunView,
} from '../domain/entities/operations.js';
import { OperationsError } from '../domain/errors/operations.error.js';
import type { GovernanceRepository } from '../domain/ports/governance.repository.js';
import { commandHash, validateRetentionSeconds } from '../domain/policies/operations.policy.js';

type Tx = Prisma.TransactionClient;
type Cursor = { at: string; id: string };
const encode = (value: Cursor) => Buffer.from(JSON.stringify(value)).toString('base64url');
function decode(value?: string): Cursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (!parsed.id || Number.isNaN(Date.parse(parsed.at))) throw new Error();
    return parsed;
  } catch {
    throw OperationsError.invalid();
  }
}
const policyView = (row: RetentionPolicyVersion): RetentionPolicyView => ({
  id: row.id,
  category: row.category,
  scopeKey: row.scopeKey,
  version: row.version,
  retentionSeconds: row.retentionSeconds,
  rationaleRef: row.rationaleRef,
  automatic: row.automatic,
  status: row.status,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt,
  activatedAt: row.activatedAt,
});
const dryView = (row: RetentionDryRun, category: RetentionCategory): RetentionDryRunView => ({
  id: row.id,
  policyId: row.policyId,
  category,
  impact: 'PHYSICAL_DELETE_OR_PURGE',
  boundaryEligibleAt: row.boundaryEligibleAt,
  candidateCount: row.candidateCount,
  earliestEligibleAt: row.earliestEligibleAt,
  latestEligibleAt: row.latestEligibleAt,
  expiresAt: row.expiresAt,
  consumedAt: row.consumedAt,
  createdAt: row.createdAt,
});
const holdView = (row: RetentionHold): RetentionHoldView => ({
  id: row.id,
  category: row.category,
  targetType: row.targetType,
  targetId: row.targetId,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  reason: row.reason,
  createdAt: row.createdAt,
  releasedAt: row.releasedAt,
});
const runView = (
  row: RetentionRun,
  context: { category: RetentionCategory; policyVersion: number; boundaryEligibleAt: Date },
): RetentionRunView => ({
  id: row.id,
  policyId: row.policyId,
  dryRunId: row.dryRunId,
  category: context.category,
  policyVersion: context.policyVersion,
  boundaryEligibleAt: context.boundaryEligibleAt,
  status: row.status,
  generation: row.generation,
  scannedCount: row.scannedCount,
  deletedCount: row.deletedCount,
  skippedCount: row.skippedCount,
  failedCount: row.failedCount,
  errorCode: row.errorCode,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
  createdAt: row.createdAt,
});
const evidenceView = (row: DeletionEvidence): DeletionEvidenceView => ({
  id: row.id,
  category: row.category,
  purpose: row.purpose,
  providerCategory: row.providerCategory,
  policyVersion: row.policyVersion,
  deadlineAt: row.deadlineAt,
  completedAt: row.completedAt,
  result: row.result,
  reasonCode: row.reasonCode,
  createdAt: row.createdAt,
});
const recoveryView = (row: RecoveryDrill): RecoveryDrillView => ({
  id: row.id,
  environment: row.environment,
  environmentId: row.environmentId,
  backupDigest: row.backupDigest,
  toolVersion: row.toolVersion,
  schemaVersion: row.schemaVersion,
  status: row.status,
  observedRpoSeconds: row.observedRpoSeconds,
  observedRtoSeconds: row.observedRtoSeconds,
  checkSummary: row.checkSummary as RecoveryDrillView['checkSummary'],
  errorCode: row.errorCode,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
});

function page<T extends { id: string }>(
  rows: T[],
  query: GovernancePageQuery,
  getAt: (row: T) => Date,
): GovernancePage<T> {
  const items = rows.slice(0, query.limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > query.limit && last
        ? encode({ at: getAt(last).toISOString(), id: last.id })
        : null,
  };
}

@Injectable()
export class PrismaGovernanceRepository implements GovernanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordPolicyRejection(
    input: Parameters<GovernanceRepository['recordPolicyRejection']>[0],
  ): Promise<void> {
    await this.prisma.$transaction((tx) =>
      appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: input.actorUserId,
        actorRoles: input.actorRoles,
        action: 'RETENTION_POLICY_CREATED',
        targetType: 'RETENTION_POLICY',
        reason: input.reasonCode,
        result: 'REJECTED',
        ...(input.requestId ? { requestId: input.requestId } : {}),
        details: { category: input.category },
      }),
    );
  }

  async createPolicy(input: Parameters<GovernanceRepository['createPolicy']>[0]) {
    validateRetentionSeconds(input.category, input.retentionSeconds);
    if (!input.scopeKey.trim() || !input.rationaleRef.trim()) throw OperationsError.invalid();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.category}:${input.scopeKey}`}, 0))`;
      const last = await tx.retentionPolicyVersion.findFirst({
        where: { category: input.category, scopeKey: input.scopeKey },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const row = await tx.retentionPolicyVersion.create({
        data: {
          id: randomUUID(),
          category: input.category,
          scopeKey: input.scopeKey.trim(),
          version: (last?.version ?? 0) + 1,
          retentionSeconds: input.retentionSeconds,
          rationaleRef: input.rationaleRef.trim(),
          automatic: input.automatic,
          createdByUserId: input.actorUserId,
        },
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: input.actorUserId,
        actorRoles: input.actorRoles,
        action: 'RETENTION_POLICY_CREATED',
        targetType: 'RETENTION_POLICY',
        targetId: row.id,
        reason: input.rationaleRef.trim(),
        result: 'SUCCEEDED',
        ...(input.requestId ? { requestId: input.requestId } : {}),
        details: {
          category: input.category,
          scopeKey: input.scopeKey,
          version: row.version,
          automatic: input.automatic,
        },
      });
      return policyView(row);
    });
  }

  async activatePolicy(input: Parameters<GovernanceRepository['activatePolicy']>[0]) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.retentionPolicyVersion.findUnique({
          where: { id: input.policyId },
        });
        if (!current) throw OperationsError.notFound();
        validateRetentionSeconds(current.category, current.retentionSeconds);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${current.category}:${current.scopeKey}`}, 0))`;
        await tx.retentionPolicyVersion.updateMany({
          where: { category: current.category, scopeKey: current.scopeKey, status: 'ACTIVE' },
          data: { status: 'SUPERSEDED' },
        });
        const row = await tx.retentionPolicyVersion.update({
          where: { id: current.id },
          data: { status: 'ACTIVE', activatedAt: new Date() },
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'USER',
          actorUserId: input.actorUserId,
          actorRoles: input.actorRoles,
          action: 'RETENTION_POLICY_ACTIVATED',
          targetType: 'RETENTION_POLICY',
          targetId: row.id,
          reason: input.reason,
          result: 'SUCCEEDED',
          ...(input.requestId ? { requestId: input.requestId } : {}),
          details: { category: row.category, scopeKey: row.scopeKey, version: row.version },
        });
        return policyView(row);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listPolicies(
    actorUserId: string,
    actorRoles: Parameters<GovernanceRepository['listPolicies']>[1],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    const cursor = decode(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.retentionPolicyVersion.findMany({
        ...(cursor
          ? {
              where: {
                OR: [
                  { createdAt: { lt: new Date(cursor.at) } },
                  { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              },
            }
          : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      await this.auditRead(
        tx,
        actorUserId,
        actorRoles,
        'RETENTION_POLICIES_VIEWED',
        query,
        requestId,
      );
      return page(rows.map(policyView), query, (row) => row.createdAt);
    });
  }

  async createDryRun(input: Parameters<GovernanceRepository['createDryRun']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.retentionDryRun.findUnique({
        where: {
          actorUserId_clientRequestId: {
            actorUserId: input.actorUserId,
            clientRequestId: input.clientRequestId,
          },
        },
        include: { policy: { select: { category: true } } },
      });
      if (replay) {
        if (replay.payloadHash !== input.payloadHash) throw OperationsError.conflict();
        return dryView(replay, replay.policy.category);
      }
      const policy = await tx.retentionPolicyVersion.findUnique({ where: { id: input.policyId } });
      if (!policy || policy.status !== 'ACTIVE' || policy.retentionSeconds === null)
        throw OperationsError.conflict('RETENTION_POLICY_NOT_ACTIVE');
      validateRetentionSeconds(policy.category, policy.retentionSeconds);
      const boundary = new Date(input.now.getTime() - policy.retentionSeconds * 1000);
      const summary = await this.candidates(tx, policy.category, boundary);
      const row = await tx.retentionDryRun.create({
        data: {
          id: randomUUID(),
          policyId: policy.id,
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          payloadHash: input.payloadHash,
          boundaryEligibleAt: boundary,
          candidateCount: summary.count,
          earliestEligibleAt: summary.earliest,
          latestEligibleAt: summary.latest,
          expiresAt: new Date(input.now.getTime() + input.ttlSeconds * 1000),
        },
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: input.actorUserId,
        actorRoles: input.actorRoles,
        action: 'RETENTION_DRY_RUN_CREATED',
        targetType: 'RETENTION_DRY_RUN',
        targetId: row.id,
        result: 'SUCCEEDED',
        ...(input.requestId ? { requestId: input.requestId } : {}),
        clientRequestId: input.clientRequestId,
        requestHash: input.payloadHash,
        details: {
          category: policy.category,
          candidateCount: row.candidateCount,
          boundaryEligibleAt: boundary.toISOString(),
        },
      });
      return dryView(row, policy.category);
    });
  }

  async listDryRuns(
    actorUserId: string,
    actorRoles: Parameters<GovernanceRepository['listDryRuns']>[1],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    const cursor = decode(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.retentionDryRun.findMany({
        ...(cursor
          ? {
              where: {
                OR: [
                  { createdAt: { lt: new Date(cursor.at) } },
                  { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              },
            }
          : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        include: { policy: { select: { category: true } } },
      });
      await this.auditRead(
        tx,
        actorUserId,
        actorRoles,
        'RETENTION_DRY_RUNS_VIEWED',
        query,
        requestId,
      );
      return page(
        rows.map((row) => dryView(row, row.policy.category)),
        query,
        (row) => row.createdAt,
      );
    });
  }

  async createHold(input: Parameters<GovernanceRepository['createHold']>[0]) {
    if (
      (input.targetType && !input.targetId) ||
      (!input.targetType && input.targetId) ||
      (input.endsAt && input.endsAt <= input.startsAt)
    )
      throw OperationsError.invalid();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.retentionHold.create({
        data: {
          id: randomUUID(),
          category: input.category,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          startsAt: input.startsAt,
          endsAt: input.endsAt ?? null,
          reason: input.reason,
          createdByUserId: input.actorUserId,
        },
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: input.actorUserId,
        actorRoles: input.actorRoles,
        action: 'RETENTION_HOLD_CREATED',
        targetType: 'RETENTION_HOLD',
        targetId: row.id,
        reason: input.reason,
        result: 'SUCCEEDED',
        ...(input.requestId ? { requestId: input.requestId } : {}),
        details: { category: input.category, targeted: !!input.targetId },
      });
      return holdView(row);
    });
  }

  async releaseHold(input: Parameters<GovernanceRepository['releaseHold']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.retentionHold
        .update({
          where: { id: input.holdId },
          data: {
            releasedAt: new Date(),
            releasedByUserId: input.actorUserId,
            releaseReason: input.reason,
          },
        })
        .catch(() => {
          throw OperationsError.notFound();
        });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: input.actorUserId,
        actorRoles: input.actorRoles,
        action: 'RETENTION_HOLD_RELEASED',
        targetType: 'RETENTION_HOLD',
        targetId: row.id,
        reason: input.reason,
        result: 'SUCCEEDED',
        ...(input.requestId ? { requestId: input.requestId } : {}),
        details: { category: row.category },
      });
      return holdView(row);
    });
  }
  async listHolds(
    actorUserId: string,
    actorRoles: Parameters<GovernanceRepository['listHolds']>[1],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    const cursor = decode(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.retentionHold.findMany({
        ...(cursor
          ? {
              where: {
                OR: [
                  { createdAt: { lt: new Date(cursor.at) } },
                  { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              },
            }
          : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      await this.auditRead(tx, actorUserId, actorRoles, 'RETENTION_HOLDS_VIEWED', query, requestId);
      return page(rows.map(holdView), query, (row) => row.createdAt);
    });
  }

  async createRun(input: Parameters<GovernanceRepository['createRun']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.retentionRun.findUnique({
        where: {
          actorUserId_clientRequestId: {
            actorUserId: input.actorUserId,
            clientRequestId: input.clientRequestId,
          },
        },
        include: { policy: true, dryRun: true },
      });
      if (replay) {
        if (replay.payloadHash !== input.payloadHash) throw OperationsError.conflict();
        return runView(replay, {
          category: replay.policy.category,
          policyVersion: replay.policy.version,
          boundaryEligibleAt: replay.dryRun.boundaryEligibleAt,
        });
      }
      const dry = await tx.retentionDryRun.findUnique({
        where: { id: input.dryRunId },
        include: { policy: true },
      });
      if (!dry || dry.expiresAt <= input.now || dry.consumedAt || dry.policy.status !== 'ACTIVE')
        throw OperationsError.conflict('RETENTION_DRY_RUN_INVALID');
      validateRetentionSeconds(dry.policy.category, dry.policy.retentionSeconds);
      const row = await tx.retentionRun.create({
        data: {
          id: randomUUID(),
          policyId: dry.policyId,
          dryRunId: dry.id,
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          payloadHash: input.payloadHash,
        },
      });
      await tx.retentionDryRun.update({ where: { id: dry.id }, data: { consumedAt: input.now } });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: input.actorUserId,
        actorRoles: input.actorRoles,
        action: 'RETENTION_RUN_CREATED',
        targetType: 'RETENTION_RUN',
        targetId: row.id,
        result: 'SUCCEEDED',
        ...(input.requestId ? { requestId: input.requestId } : {}),
        clientRequestId: input.clientRequestId,
        requestHash: input.payloadHash,
        details: { category: dry.policy.category, dryRunId: dry.id },
      });
      return runView(row, {
        category: dry.policy.category,
        policyVersion: dry.policy.version,
        boundaryEligibleAt: dry.boundaryEligibleAt,
      });
    });
  }

  async scheduleAutomaticRuns(now: Date, dryRunTtlSeconds: number): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('operations:auto-retention', 0))`;
      const policies = await tx.retentionPolicyVersion.findMany({
        where: { status: 'ACTIVE', automatic: true, retentionSeconds: { not: null } },
        orderBy: [{ category: 'asc' }, { scopeKey: 'asc' }],
      });
      let created = 0;
      for (const policy of policies) {
        validateRetentionSeconds(policy.category, policy.retentionSeconds);
        const inFlight = await tx.retentionRun.count({
          where: { policyId: policy.id, status: { in: ['PENDING', 'RUNNING'] } },
        });
        if (inFlight) continue;
        const boundary = new Date(now.getTime() - policy.retentionSeconds! * 1000);
        const summary = await this.candidates(tx, policy.category, boundary);
        if (!summary.count) continue;
        const dryId = randomUUID();
        const dryClientRequestId = randomUUID();
        const dryHash = commandHash({ policyId: policy.id, boundary: boundary.toISOString() });
        await tx.retentionDryRun.create({
          data: {
            id: dryId,
            policyId: policy.id,
            actorUserId: policy.createdByUserId,
            clientRequestId: dryClientRequestId,
            payloadHash: dryHash,
            boundaryEligibleAt: boundary,
            candidateCount: summary.count,
            earliestEligibleAt: summary.earliest,
            latestEligibleAt: summary.latest,
            expiresAt: new Date(now.getTime() + dryRunTtlSeconds * 1000),
            consumedAt: now,
          },
        });
        const runId = randomUUID();
        const runClientRequestId = randomUUID();
        const runHash = commandHash({ dryRunId: dryId, automatic: true });
        await tx.retentionRun.create({
          data: {
            id: runId,
            policyId: policy.id,
            dryRunId: dryId,
            actorUserId: policy.createdByUserId,
            clientRequestId: runClientRequestId,
            payloadHash: runHash,
          },
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'SYSTEM_JOB',
          actorRoles: [],
          action: 'RETENTION_DRY_RUN_CREATED',
          targetType: 'RETENTION_DRY_RUN',
          targetId: dryId,
          result: 'SUCCEEDED',
          clientRequestId: dryClientRequestId,
          requestHash: dryHash,
          details: { category: policy.category, candidateCount: summary.count, automatic: true },
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'SYSTEM_JOB',
          actorRoles: [],
          action: 'RETENTION_RUN_CREATED',
          targetType: 'RETENTION_RUN',
          targetId: runId,
          result: 'SUCCEEDED',
          clientRequestId: runClientRequestId,
          requestHash: runHash,
          details: { category: policy.category, automatic: true },
        });
        created += 1;
      }
      return created;
    });
  }

  async claimRun(leaseSeconds: number, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM "RetentionRun" WHERE status IN ('PENDING','RUNNING') AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now}) ORDER BY "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      const row = await tx.retentionRun.update({
        where: { id: rows[0].id },
        data: {
          status: 'RUNNING',
          generation: { increment: 1 },
          leaseId: randomUUID(),
          lockedUntil: new Date(now.getTime() + leaseSeconds * 1000),
          startedAt: now,
        },
        include: { policy: true, dryRun: true },
      });
      return runView(row, {
        category: row.policy.category,
        policyVersion: row.policy.version,
        boundaryEligibleAt: row.dryRun.boundaryEligibleAt,
      });
    });
  }

  async executeBatch(runId: string, generation: number, batchSize: number, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.retentionRun.findUnique({
        where: { id: runId },
        include: { policy: true, dryRun: true },
      });
      if (
        !run ||
        run.status !== 'RUNNING' ||
        run.generation !== generation ||
        !run.lockedUntil ||
        run.lockedUntil <= now
      )
        throw OperationsError.conflict('RETENTION_RUN_FENCED');
      const hold = await tx.retentionHold.findFirst({
        where: {
          category: run.policy.category,
          releasedAt: null,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      });
      let result;
      if (hold) {
        const dry = await tx.retentionDryRun.findUniqueOrThrow({ where: { id: run.dryRunId } });
        const summary = await this.candidates(tx, run.policy.category, dry.boundaryEligibleAt);
        result = {
          scanned: 0,
          deleted: 0,
          skipped: Math.min(batchSize, summary.count),
          remaining: false,
          cursorAt: null,
          cursorId: null,
        };
      } else result = await this.deleteBatch(tx, run.policy.category, run.dryRunId, batchSize);
      const sequence = await tx.retentionRunBatch.count({ where: { runId, generation } });
      await tx.retentionRunBatch.create({
        data: {
          id: randomUUID(),
          runId,
          generation,
          sequence: sequence + 1,
          cursorAt: result.cursorAt,
          cursorId: result.cursorId,
          scannedCount: result.scanned,
          deletedCount: result.deleted,
          skippedCount: result.skipped,
          failedCount: 0,
        },
      });
      const completed = !result.remaining;
      const updated = await tx.retentionRun.update({
        where: { id: runId },
        data: {
          scannedCount: { increment: result.scanned },
          deletedCount: { increment: result.deleted },
          skippedCount: { increment: result.skipped },
          cursorAt: result.cursorAt,
          cursorId: result.cursorId,
          ...(completed
            ? { status: 'COMPLETED', completedAt: now, lockedUntil: null }
            : { lockedUntil: new Date(now.getTime() + 60_000) }),
        },
        include: { policy: true, dryRun: true },
      });
      if (completed)
        await appendBackofficeAuditEvent(tx, {
          actorType: 'USER',
          actorUserId: run.actorUserId,
          actorRoles: ['PLATFORM_ADMIN'],
          action: 'RETENTION_RUN_COMPLETED',
          targetType: 'RETENTION_RUN',
          targetId: run.id,
          result: 'SUCCEEDED',
          details: {
            category: run.policy.category,
            deletedCount: updated.deletedCount,
            skippedCount: updated.skippedCount,
          },
        });
      return runView(updated, {
        category: updated.policy.category,
        policyVersion: updated.policy.version,
        boundaryEligibleAt: updated.dryRun.boundaryEligibleAt,
      });
    });
  }
  async listRuns(
    actorUserId: string,
    actorRoles: Parameters<GovernanceRepository['listRuns']>[1],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    const cursor = decode(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.retentionRun.findMany({
        ...(cursor
          ? {
              where: {
                OR: [
                  { createdAt: { lt: new Date(cursor.at) } },
                  { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              },
            }
          : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        include: { policy: true, dryRun: true },
      });
      await this.auditRead(tx, actorUserId, actorRoles, 'RETENTION_RUNS_VIEWED', query, requestId);
      return page(
        rows.map((row) =>
          runView(row, {
            category: row.policy.category,
            policyVersion: row.policy.version,
            boundaryEligibleAt: row.dryRun.boundaryEligibleAt,
          }),
        ),
        query,
        (row) => row.createdAt,
      );
    });
  }

  async recordDeletionEvidence(
    input: Parameters<GovernanceRepository['recordDeletionEvidence']>[0],
  ) {
    await this.prisma.deletionEvidence.create({
      data: {
        id: randomUUID(),
        category: input.category,
        purpose: input.purpose,
        providerCategory: input.providerCategory ?? null,
        policyVersion: input.policyVersion,
        deadlineAt: input.deadlineAt,
        completedAt: input.completedAt ?? null,
        result: input.result,
        reasonCode: input.reasonCode ?? null,
      },
    });
  }
  async listDeletionEvidence(
    actorUserId: string,
    actorRoles: Parameters<GovernanceRepository['listDeletionEvidence']>[1],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    const cursor = decode(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.deletionEvidence.findMany({
        ...(cursor
          ? {
              where: {
                OR: [
                  { createdAt: { lt: new Date(cursor.at) } },
                  { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              },
            }
          : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      await this.auditRead(
        tx,
        actorUserId,
        actorRoles,
        'DELETION_EVIDENCE_VIEWED',
        query,
        requestId,
      );
      return page(rows.map(evidenceView), query, (row) => row.createdAt);
    });
  }

  async recordRecoveryDrill(input: Parameters<GovernanceRepository['recordRecoveryDrill']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.recoveryDrill.findUnique({
        where: {
          actorUserId_clientRequestId: {
            actorUserId: input.actorUserId,
            clientRequestId: input.clientRequestId,
          },
        },
      });
      if (replay) {
        if (replay.payloadHash !== input.payloadHash) throw OperationsError.conflict();
        return recoveryView(replay);
      }
      const row = await tx.recoveryDrill.create({
        data: {
          id: randomUUID(),
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          payloadHash: input.payloadHash,
          environment: input.environment,
          environmentId: input.environmentId,
          backupDigest: input.backupDigest,
          toolVersion: input.toolVersion,
          schemaVersion: input.schemaVersion,
          status: input.status,
          observedRpoSeconds: input.observedRpoSeconds,
          observedRtoSeconds: input.observedRtoSeconds,
          checkSummary: input.checkSummary,
          errorCode: input.errorCode ?? null,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
        },
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: input.actorUserId,
        actorRoles: input.actorRoles,
        action: 'RECOVERY_DRILL_RECORDED',
        targetType: 'RECOVERY_DRILL',
        targetId: row.id,
        result: input.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'REJECTED',
        ...(input.requestId ? { requestId: input.requestId } : {}),
        clientRequestId: input.clientRequestId,
        requestHash: input.payloadHash,
        details: {
          environment: input.environment,
          environmentId: input.environmentId,
          status: input.status,
          observedRpoSeconds: input.observedRpoSeconds,
          observedRtoSeconds: input.observedRtoSeconds,
        },
      });
      return recoveryView(row);
    });
  }
  async listRecoveryDrills(
    actorUserId: string,
    actorRoles: Parameters<GovernanceRepository['listRecoveryDrills']>[1],
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    const cursor = decode(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.recoveryDrill.findMany({
        ...(cursor
          ? {
              where: {
                OR: [
                  { startedAt: { lt: new Date(cursor.at) } },
                  { startedAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              },
            }
          : {}),
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      await this.auditRead(tx, actorUserId, actorRoles, 'RECOVERY_DRILLS_VIEWED', query, requestId);
      return page(rows.map(recoveryView), query, (row) => row.startedAt);
    });
  }

  async failRun(runId: string, generation: number, errorCode: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.retentionRun.updateMany({
        where: { id: runId, generation, status: 'RUNNING' },
        data: {
          status: 'FAILED',
          failedCount: { increment: 1 },
          errorCode: errorCode.slice(0, 64),
          completedAt: now,
          lockedUntil: null,
        },
      });
      if (!updated.count) return;
      const sequence = await tx.retentionRunBatch.count({ where: { runId, generation } });
      await tx.retentionRunBatch.create({
        data: {
          id: randomUUID(),
          runId,
          generation,
          sequence: sequence + 1,
          scannedCount: 0,
          deletedCount: 0,
          skippedCount: 0,
          failedCount: 1,
        },
      });
    });
  }

  async health(now: Date) {
    const [
      openIncidents,
      failedDeliveries,
      pendingRuns,
      uncertainDeletion,
      latestMetric,
      failedDrills,
      overdueRealtimeCommands,
      overdueKeywordJobs,
      unassignedSafetyCases,
      overdueRestrictions,
      dependencyIncidents,
    ] = await Promise.all([
      this.prisma.operationalIncident.count({ where: { status: { not: 'RESOLVED' } } }),
      this.prisma.operationalAlertDelivery.count({ where: { status: 'FAILED' } }),
      this.prisma.retentionRun.count({
        where: { status: { in: ['PENDING', 'RUNNING', 'FAILED'] } },
      }),
      this.prisma.deletionEvidence.count({
        where: { result: { in: ['UNCERTAIN', 'FAILED'] }, deadlineAt: { lt: now } },
      }),
      this.prisma.metricSnapshot.findFirst({
        orderBy: { generatedAt: 'desc' },
        select: { generatedAt: true },
      }),
      this.prisma.recoveryDrill.count({ where: { status: 'FAILED' } }),
      this.prisma.realtimeCommand.count({
        where: { status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lt: now } },
      }),
      this.prisma.roomKeywordSummaryJob.count({
        where: { status: { in: ['PENDING', 'FAILED'] }, deadlineAt: { lt: now } },
      }),
      this.prisma.safetyCase.count({
        where: {
          status: 'OPEN',
          assigneeUserId: null,
          createdAt: { lt: new Date(now.getTime() - 10 * 60_000) },
        },
      }),
      this.prisma.safetyRestriction.count({
        where: { status: 'ACTIVE', endsAt: { not: null, lte: now } },
      }),
      this.prisma.operationalIncident.groupBy({
        by: ['component', 'reasonCode'],
        where: { status: { not: 'RESOLVED' } },
        _count: { _all: true },
        orderBy: [{ component: 'asc' }, { reasonCode: 'asc' }],
      }),
    ]);
    return {
      status:
        openIncidents +
          failedDeliveries +
          pendingRuns +
          uncertainDeletion +
          failedDrills +
          overdueRealtimeCommands +
          overdueKeywordJobs +
          unassignedSafetyCases +
          overdueRestrictions >
        0
          ? 'degraded'
          : 'ok',
      sampledAt: now,
      components: {
        incidents: { open: openIncidents },
        alertDelivery: { failed: failedDeliveries },
        retention: { pendingOrFailed: pendingRuns },
        deletionEvidence: { overdueUncertain: uncertainDeletion },
        metrics: { latestGeneratedAt: latestMetric?.generatedAt ?? null },
        recovery: { failed: failedDrills },
        commandBacklog: { overdue: overdueRealtimeCommands },
        keywordJobs: { overdue: overdueKeywordJobs },
        safetyAssignment: { overdue: unassignedSafetyCases },
        restrictionRecovery: { overdue: overdueRestrictions },
        dependencyIncidents: dependencyIncidents.map((row) => ({
          component: row.component,
          reasonCode: row.reasonCode,
          status: 'degraded',
          count: row._count._all,
        })),
      },
    };
  }

  private async candidates(tx: Tx, category: RetentionCategory, boundary: Date) {
    if (category === 'SHORT_TERM_AI_OUTPUT') {
      const rows = await tx.aiExpressionRequest.aggregate({
        where: {
          output: { not: Prisma.JsonNull },
          outputExpiresAt: { lt: boundary },
          outputPurgedAt: null,
        },
        _count: true,
        _min: { outputExpiresAt: true },
        _max: { outputExpiresAt: true },
      });
      return {
        count: rows._count,
        earliest: rows._min.outputExpiresAt,
        latest: rows._max.outputExpiresAt,
      };
    }
    if (category === 'OPERATIONS_METRIC') {
      const rows = await tx.metricSnapshot.aggregate({
        where: { generatedAt: { lt: boundary } },
        _count: true,
        _min: { generatedAt: true },
        _max: { generatedAt: true },
      });
      return { count: rows._count, earliest: rows._min.generatedAt, latest: rows._max.generatedAt };
    }
    if (category === 'TECHNICAL_COMMAND') {
      const rows = await tx.$queryRaw<
        Array<{ count: bigint; earliest: Date | null; latest: Date | null }>
      >(Prisma.sql`
        SELECT COUNT(*)::bigint count, MIN("eligibleAt") earliest, MAX("eligibleAt") latest
        FROM (
          SELECT "createdAt" "eligibleAt" FROM "OperationalCommand" WHERE "createdAt" < ${boundary}
          UNION ALL SELECT "createdAt" FROM "SocialCommand" WHERE "createdAt" < ${boundary}
          UNION ALL SELECT "createdAt" FROM "SafetyCommand" WHERE "createdAt" < ${boundary}
          UNION ALL SELECT "createdAt" FROM "AccountLifecycleCommand" WHERE status='COMPLETED' AND "createdAt" < ${boundary}
          UNION ALL SELECT "createdAt" FROM "VocabularyCommand" WHERE "createdAt" < ${boundary}
          UNION ALL SELECT "completedAt" FROM "RealtimeCommand" WHERE status='COMPLETED' AND "completedAt" < ${boundary}
          UNION ALL SELECT "completedAt" FROM "RoomKeywordSummaryJob" WHERE status='COMPLETED' AND "completedAt" < ${boundary}
        ) candidates`);
      return {
        count: Number(rows[0]?.count ?? 0n),
        earliest: rows[0]?.earliest ?? null,
        latest: rows[0]?.latest ?? null,
      };
    }
    if (category === 'TEMPORARY_SPEECH_CONTENT') {
      const rows = await tx.roomSpeechRiskEvent.aggregate({
        where: { lastOccurredAt: { lt: boundary } },
        _count: true,
        _min: { lastOccurredAt: true },
        _max: { lastOccurredAt: true },
      });
      return {
        count: rows._count,
        earliest: rows._min.lastOccurredAt,
        latest: rows._max.lastOccurredAt,
      };
    }
    return { count: 0, earliest: null, latest: null };
  }

  private async deleteBatch(
    tx: Tx,
    category: RetentionCategory,
    dryRunId: string,
    batchSize: number,
  ) {
    const dry = await tx.retentionDryRun.findUniqueOrThrow({ where: { id: dryRunId } });
    if (category === 'SHORT_TERM_AI_OUTPUT') {
      const rows = await tx.aiExpressionRequest.findMany({
        where: {
          output: { not: Prisma.JsonNull },
          outputExpiresAt: { lt: dry.boundaryEligibleAt },
          outputPurgedAt: null,
        },
        orderBy: [{ outputExpiresAt: 'asc' }, { id: 'asc' }],
        take: batchSize,
        select: { id: true, outputExpiresAt: true },
      });
      if (rows.length)
        await tx.aiExpressionRequest.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: { output: Prisma.JsonNull, outputPurgedAt: new Date() },
        });
      const remaining = await tx.aiExpressionRequest.count({
        where: {
          output: { not: Prisma.JsonNull },
          outputExpiresAt: { lt: dry.boundaryEligibleAt },
          outputPurgedAt: null,
        },
      });
      const last = rows.at(-1);
      return {
        scanned: rows.length,
        deleted: rows.length,
        skipped: 0,
        remaining: remaining > 0,
        cursorAt: last?.outputExpiresAt ?? null,
        cursorId: last?.id ?? null,
      };
    }
    if (category === 'OPERATIONS_METRIC') {
      const rows = await tx.metricSnapshot.findMany({
        where: { generatedAt: { lt: dry.boundaryEligibleAt } },
        orderBy: [{ generatedAt: 'asc' }, { id: 'asc' }],
        take: batchSize,
        select: { id: true, generatedAt: true },
      });
      if (rows.length)
        await tx.metricSnapshot.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      const remaining = await tx.metricSnapshot.count({
        where: { generatedAt: { lt: dry.boundaryEligibleAt } },
      });
      const last = rows.at(-1);
      return {
        scanned: rows.length,
        deleted: rows.length,
        skipped: 0,
        remaining: remaining > 0,
        cursorAt: last?.generatedAt ?? null,
        cursorId: last?.id ?? null,
      };
    }
    if (category === 'TECHNICAL_COMMAND') {
      let capacity = batchSize;
      let deleted = 0;
      let cursorAt: Date | null = null;
      let cursorId: string | null = null;
      const consume = async (
        query: (limit: number) => Promise<Array<{ id: string; eligibleAt: Date }>>,
      ) => {
        if (capacity <= 0) return;
        const rows = await query(capacity);
        capacity -= rows.length;
        deleted += rows.length;
        const last = rows.at(-1);
        if (last) {
          cursorAt = last.eligibleAt;
          cursorId = last.id;
        }
      };
      await consume((limit) =>
        tx.$queryRaw(
          Prisma.sql`WITH c AS (SELECT id FROM "OperationalCommand" WHERE "createdAt" < ${dry.boundaryEligibleAt} ORDER BY "createdAt",id LIMIT ${limit}) DELETE FROM "OperationalCommand" t USING c WHERE t.id=c.id RETURNING t.id,t."createdAt" "eligibleAt"`,
        ),
      );
      await consume((limit) =>
        tx.$queryRaw(
          Prisma.sql`WITH c AS (SELECT id FROM "SocialCommand" WHERE "createdAt" < ${dry.boundaryEligibleAt} ORDER BY "createdAt",id LIMIT ${limit}) DELETE FROM "SocialCommand" t USING c WHERE t.id=c.id RETURNING t.id,t."createdAt" "eligibleAt"`,
        ),
      );
      await consume((limit) =>
        tx.$queryRaw(
          Prisma.sql`WITH c AS (SELECT id FROM "SafetyCommand" WHERE "createdAt" < ${dry.boundaryEligibleAt} ORDER BY "createdAt",id LIMIT ${limit}) DELETE FROM "SafetyCommand" t USING c WHERE t.id=c.id RETURNING t.id,t."createdAt" "eligibleAt"`,
        ),
      );
      await consume((limit) =>
        tx.$queryRaw(
          Prisma.sql`WITH c AS (SELECT id FROM "AccountLifecycleCommand" WHERE status='COMPLETED' AND "createdAt" < ${dry.boundaryEligibleAt} ORDER BY "createdAt",id LIMIT ${limit}) DELETE FROM "AccountLifecycleCommand" t USING c WHERE t.id=c.id RETURNING t.id,t."createdAt" "eligibleAt"`,
        ),
      );
      await consume((limit) =>
        tx.$queryRaw(
          Prisma.sql`WITH c AS (SELECT id FROM "VocabularyCommand" WHERE "createdAt" < ${dry.boundaryEligibleAt} ORDER BY "createdAt",id LIMIT ${limit}) DELETE FROM "VocabularyCommand" t USING c WHERE t.id=c.id RETURNING t.id,t."createdAt" "eligibleAt"`,
        ),
      );
      await consume((limit) =>
        tx.$queryRaw(
          Prisma.sql`WITH c AS (SELECT id FROM "RealtimeCommand" WHERE status='COMPLETED' AND "completedAt" < ${dry.boundaryEligibleAt} ORDER BY "completedAt",id LIMIT ${limit}) DELETE FROM "RealtimeCommand" t USING c WHERE t.id=c.id RETURNING t.id,t."completedAt" "eligibleAt"`,
        ),
      );
      await consume((limit) =>
        tx.$queryRaw(
          Prisma.sql`WITH c AS (SELECT id FROM "RoomKeywordSummaryJob" WHERE status='COMPLETED' AND "completedAt" < ${dry.boundaryEligibleAt} ORDER BY "completedAt",id LIMIT ${limit}) DELETE FROM "RoomKeywordSummaryJob" t USING c WHERE t.id=c.id RETURNING t.id,t."completedAt" "eligibleAt"`,
        ),
      );
      const summary = await this.candidates(tx, category, dry.boundaryEligibleAt);
      return {
        scanned: deleted,
        deleted,
        skipped: 0,
        remaining: summary.count > 0,
        cursorAt,
        cursorId,
      };
    }
    if (category === 'TEMPORARY_SPEECH_CONTENT') {
      const rows = await tx.roomSpeechRiskEvent.findMany({
        where: { lastOccurredAt: { lt: dry.boundaryEligibleAt } },
        orderBy: [{ lastOccurredAt: 'asc' }, { id: 'asc' }],
        take: batchSize,
        select: { id: true, lastOccurredAt: true },
      });
      const ids = rows.map((row) => row.id);
      if (ids.length) {
        await tx.roomSpeechAlertDelivery.deleteMany({ where: { riskEventId: { in: ids } } });
        await tx.roomSpeechRiskEvent.deleteMany({ where: { id: { in: ids } } });
      }
      const remaining = await tx.roomSpeechRiskEvent.count({
        where: { lastOccurredAt: { lt: dry.boundaryEligibleAt } },
      });
      const last = rows.at(-1);
      return {
        scanned: ids.length,
        deleted: ids.length,
        skipped: 0,
        remaining: remaining > 0,
        cursorAt: last?.lastOccurredAt ?? null,
        cursorId: last?.id ?? null,
      };
    }
    return {
      scanned: 0,
      deleted: 0,
      skipped: 0,
      remaining: false,
      cursorAt: null,
      cursorId: null,
    };
  }

  private async auditRead(
    tx: Tx,
    actorUserId: string,
    actorRoles: Parameters<GovernanceRepository['listPolicies']>[1],
    action:
      | 'RETENTION_POLICIES_VIEWED'
      | 'RETENTION_DRY_RUNS_VIEWED'
      | 'RETENTION_HOLDS_VIEWED'
      | 'RETENTION_RUNS_VIEWED'
      | 'DELETION_EVIDENCE_VIEWED'
      | 'RECOVERY_DRILLS_VIEWED',
    query: GovernancePageQuery,
    requestId?: string,
  ) {
    await appendBackofficeAuditEvent(tx, {
      actorType: 'USER',
      actorUserId,
      actorRoles,
      action,
      targetType: 'DATA_GOVERNANCE_LIST',
      result: 'SUCCEEDED',
      ...(requestId ? { requestId } : {}),
      details: { limit: query.limit, paginated: Boolean(query.cursor) },
    });
  }
}
