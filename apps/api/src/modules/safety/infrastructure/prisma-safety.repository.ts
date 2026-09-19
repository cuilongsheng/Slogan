import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type BackofficeRole,
  type SafetyAppeal,
  type SafetyAppealStatus as PrismaSafetyAppealStatus,
  type SafetyCase,
  type SafetyRestriction,
} from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { appendBackofficeAuditEvent } from '../../audit/persistence.js';
import { lockPlatformAdminSet } from '../../backoffice/index.js';
import type {
  SafetyActor,
  SafetyAppealDecision,
  SafetyCaseQuery,
  SafetyCommandInput,
  SafetyResolveInput,
} from '../domain/entities/safety.js';
import { SafetyError } from '../domain/errors/safety.error.js';
import type { SafetyRepository } from '../domain/ports/safety.repository.js';
import {
  appealCommandContent,
  appealDeadline,
  caseCommandContent,
  normalizeSafetyReason,
  restrictionEndsAt,
  validateResolution,
} from '../domain/policies/safety.policy.js';
import { assignSafetyCase, databaseNow } from '../persistence.js';

type Tx = Prisma.TransactionClient;
type JsonObject = Record<string, unknown>;
type Cursor = { at: string; id: string };
type RejectionAudit = Pick<
  Parameters<typeof appendBackofficeAuditEvent>[1],
  'action' | 'targetType' | 'targetId' | 'requestId'
> & { includeOrdinaryUser?: boolean };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function encodeCursor(value: Cursor): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeCursor(value?: string): Cursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as Cursor;
    if (!uuidPattern.test(parsed.id) || Number.isNaN(Date.parse(parsed.at))) throw new Error();
    return parsed;
  } catch {
    throw SafetyError.validation();
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function caseDto(row: SafetyCase & { report: { category: string } }) {
  return {
    id: row.id,
    reportId: row.reportId,
    roomId: row.roomId,
    targetUserId: row.targetUserId,
    category: row.report.category,
    status: row.status,
    assigneeUserId: row.assigneeUserId,
    assignedAt: row.assignedAt?.toISOString() ?? null,
    reviewStartedAt: row.reviewStartedAt?.toISOString() ?? null,
    assessedSeverity: row.assessedSeverity,
    decisionType: row.decisionType,
    decisionReason: row.decisionReason,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
  };
}

function restrictionDto(
  row: SafetyRestriction & { appeal?: { status: PrismaSafetyAppealStatus } | null },
  now: Date,
) {
  const effectiveStatus =
    row.kind === 'TEMPORARY' &&
    row.status === 'ACTIVE' &&
    row.liftedAt === null &&
    row.endsAt &&
    row.endsAt <= now
      ? 'EXPIRED'
      : row.status;
  return {
    id: row.id,
    caseId: row.caseId,
    userId: row.userId,
    kind: row.kind,
    severity: row.severity,
    status: effectiveStatus,
    reason: row.reason,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    appealDeadlineAt: row.appealDeadlineAt?.toISOString() ?? null,
    liftedAt: row.liftedAt?.toISOString() ?? null,
    expiredAt: row.expiredAt?.toISOString() ?? null,
    version: row.version,
    appealStatus: row.appeal?.status ?? null,
  };
}

function ownRestrictionDto(
  row: SafetyRestriction & { appeal?: { status: PrismaSafetyAppealStatus } | null },
  now: Date,
) {
  const projected = restrictionDto(row, now);
  return {
    id: projected.id,
    severity: projected.severity,
    reason: projected.reason,
    startsAt: projected.startsAt,
    endsAt: projected.endsAt,
    status: projected.status,
    appealDeadlineAt: projected.appealDeadlineAt,
    appealStatus: projected.appealStatus,
  };
}

function appealDto(row: SafetyAppeal) {
  return {
    id: row.id,
    restrictionId: row.restrictionId,
    userId: row.userId,
    status: row.status,
    reason: row.reason,
    submittedAt: row.submittedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedByUserId: row.decidedByUserId,
    decisionReason: row.decisionReason,
  };
}

@Injectable()
export class PrismaSafetyRepository implements SafetyRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async currentRoles(tx: Tx, userId: string): Promise<BackofficeRole[]> {
    const rows = await tx.backofficeRoleAssignment.findMany({
      where: { userId, revokedAt: null, user: { status: 'ACTIVE' } },
      select: { role: true },
    });
    return rows.map((row) => row.role);
  }

  private async officer(tx: Tx, userId: string): Promise<BackofficeRole[]> {
    const roles = await this.currentRoles(tx, userId);
    if (!roles.includes('SAFETY_OFFICER')) throw SafetyError.denied();
    return roles;
  }

  private async reader(tx: Tx, userId: string): Promise<BackofficeRole[]> {
    const roles = await this.currentRoles(tx, userId);
    if (!roles.includes('PLATFORM_ADMIN') && !roles.includes('SAFETY_OFFICER'))
      throw SafetyError.denied();
    return roles;
  }

  async listCases(actor: SafetyActor, query: SafetyCaseQuery) {
    const cursor = decodeCursor(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const roles = await this.reader(tx, actor.userId);
      const all = roles.includes('PLATFORM_ADMIN');
      const rows = await tx.safetyCase.findMany({
        where: {
          AND: [
            ...(all ? [] : [{ OR: [{ assigneeUserId: actor.userId }, { assigneeUserId: null }] }]),
            ...(cursor
              ? [
                  {
                    OR: [
                      { createdAt: { lt: new Date(cursor.at) } },
                      { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
                    ],
                  },
                ]
              : []),
          ],
          ...(query.status ? { status: query.status } : {}),
          ...(query.targetUserId ? { targetUserId: query.targetUserId } : {}),
          ...(query.from || query.to
            ? {
                createdAt: {
                  ...(query.from ? { gte: query.from } : {}),
                  ...(query.to ? { lte: query.to } : {}),
                },
              }
            : {}),
        },
        include: { report: { select: { category: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: actor.userId,
        actorRoles: roles,
        action: 'SAFETY_CASES_VIEWED',
        targetType: 'SAFETY_CASE_LIST',
        result: 'SUCCEEDED',
        ...(actor.requestId ? { requestId: actor.requestId } : {}),
        details: {
          filtered: Boolean(query.status || query.targetUserId || query.from || query.to),
        },
      });
      const items = rows.slice(0, query.limit);
      const last = items.at(-1);
      return {
        items: items.map(caseDto),
        nextCursor:
          rows.length > query.limit && last
            ? encodeCursor({ at: last.createdAt.toISOString(), id: last.id })
            : null,
      };
    });
  }

  async caseDetail(actor: SafetyActor, caseId: string) {
    return this.prisma.$transaction(async (tx) => {
      const roles = await this.reader(tx, actor.userId);
      const row = await tx.safetyCase.findUnique({
        where: { id: caseId },
        include: { report: { select: { category: true } } },
      });
      if (!row) throw SafetyError.caseNotFound();
      if (
        !roles.includes('PLATFORM_ADMIN') &&
        row.assigneeUserId !== actor.userId &&
        row.assigneeUserId !== null
      )
        throw SafetyError.denied();
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: actor.userId,
        actorRoles: roles,
        action: 'SAFETY_CASE_VIEWED',
        targetType: 'SAFETY_CASE',
        targetId: caseId,
        result: 'SUCCEEDED',
        ...(actor.requestId ? { requestId: actor.requestId } : {}),
      });
      return caseDto(row);
    });
  }

  async evidence(actor: SafetyActor, caseId: string) {
    return this.prisma.$transaction(async (tx) => {
      const roles = await this.reader(tx, actor.userId);
      const row = await tx.safetyCase.findUnique({
        where: { id: caseId },
        include: {
          report: true,
          room: { select: { sensitiveSpeechDetectionEnabled: true } },
          participants: { orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }], take: 100 },
          activities: { orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: 100 },
        },
      });
      if (!row) throw SafetyError.caseNotFound();
      if (!roles.includes('PLATFORM_ADMIN') && row.assigneeUserId !== actor.userId)
        throw SafetyError.denied();
      const signalFrom = new Date(row.report.submittedAt.getTime() - 30 * 60_000);
      const signalTo = new Date(row.report.submittedAt.getTime() + 30 * 60_000);
      const [events, relatedReports, relatedCases, restrictions, speechRisks, speechIncidents] =
        await Promise.all([
          tx.roomEvent.findMany({
            where: { roomId: row.roomId },
            orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
            take: 101,
            select: {
              id: true,
              type: true,
              source: true,
              actorId: true,
              targetId: true,
              reason: true,
              result: true,
              occurredAt: true,
            },
          }),
          tx.report.findMany({
            where: { targetUserId: row.targetUserId, id: { not: row.reportId } },
            orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
            take: 101,
            select: { id: true, roomId: true, category: true, submittedAt: true },
          }),
          tx.safetyCase.findMany({
            where: { targetUserId: row.targetUserId, id: { not: row.id } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 101,
            select: {
              id: true,
              status: true,
              assessedSeverity: true,
              decisionType: true,
              createdAt: true,
            },
          }),
          tx.safetyRestriction.findMany({
            where: { userId: row.targetUserId },
            orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
            take: 101,
            select: {
              id: true,
              kind: true,
              severity: true,
              status: true,
              startsAt: true,
              endsAt: true,
              liftedAt: true,
            },
          }),
          tx.roomSpeechRiskEvent.findMany({
            where: {
              roomId: row.roomId,
              subjectUserId: row.targetUserId,
              lastOccurredAt: { gte: signalFrom, lte: signalTo },
            },
            orderBy: [{ lastOccurredAt: 'asc' }, { id: 'asc' }],
            take: 101,
            select: {
              id: true,
              subjectUserId: true,
              category: true,
              severity: true,
              ruleSetVersion: true,
              firstOccurredAt: true,
              lastOccurredAt: true,
              occurrenceCount: true,
            },
          }),
          tx.safetyCapabilityIncident.findMany({
            where: {
              roomId: row.roomId,
              startedAt: { lte: signalTo },
              OR: [{ recoveredAt: null }, { recoveredAt: { gte: signalFrom } }],
            },
            orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
            take: 101,
            select: {
              id: true,
              component: true,
              errorCategory: true,
              status: true,
              startedAt: true,
              lastObservedAt: true,
              recoveredAt: true,
            },
          }),
        ]);
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: actor.userId,
        actorRoles: roles,
        action: 'SAFETY_EVIDENCE_VIEWED',
        targetType: 'SAFETY_CASE',
        targetId: caseId,
        result: 'SUCCEEDED',
        ...(actor.requestId ? { requestId: actor.requestId } : {}),
      });
      const limit = <T>(items: T[]) => ({
        items: items.slice(0, 100),
        truncated: items.length > 100,
      });
      return {
        caseId: row.id,
        report: {
          id: row.report.id,
          roomId: row.report.roomId,
          reporterUserId: row.report.reporterUserId,
          targetUserId: row.report.targetUserId,
          category: row.report.category,
          description: row.report.description,
          submittedAt: row.report.submittedAt.toISOString(),
        },
        participants: row.participants.map((item) => ({
          userId: item.userId,
          role: item.role,
          lifecycle: item.lifecycle,
          joinedAt: item.joinedAt.toISOString(),
          leftAt: item.leftAt?.toISOString() ?? null,
          removedAt: item.removedAt?.toISOString() ?? null,
          capturedAt: item.capturedAt.toISOString(),
        })),
        roomEvents: limit(
          events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
        ),
        relatedReports: limit(
          relatedReports.map((item) => ({ ...item, submittedAt: item.submittedAt.toISOString() })),
        ),
        relatedCases: limit(
          relatedCases.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
        ),
        restrictions: limit(
          restrictions.map((item) => ({
            ...item,
            startsAt: item.startsAt.toISOString(),
            endsAt: item.endsAt?.toISOString() ?? null,
            liftedAt: item.liftedAt?.toISOString() ?? null,
          })),
        ),
        speechSignals: {
          availability: !row.room.sensitiveSpeechDetectionEnabled
            ? 'NOT_ENABLED'
            : speechIncidents.length > 0
              ? 'DEGRADED'
              : 'AVAILABLE',
          riskEvents: limit(
            speechRisks.map((item) => ({
              ...item,
              firstOccurredAt: item.firstOccurredAt.toISOString(),
              lastOccurredAt: item.lastOccurredAt.toISOString(),
            })),
          ),
          capabilityIncidents: limit(
            speechIncidents.map((item) => ({
              ...item,
              startedAt: item.startedAt.toISOString(),
              lastObservedAt: item.lastObservedAt.toISOString(),
              recoveredAt: item.recoveredAt?.toISOString() ?? null,
            })),
          ),
        },
        activities: row.activities.map((item) => ({
          id: item.id,
          type: item.type,
          actorType: item.actorType,
          actorUserId: item.actorUserId,
          fromStatus: item.fromStatus,
          toStatus: item.toStatus,
          assigneeUserId: item.assigneeUserId,
          reason: item.reason,
          occurredAt: item.occurredAt.toISOString(),
        })),
      };
    });
  }

  private async runCommand(
    actorUserId: string,
    clientRequestId: string,
    action: string,
    content: string,
    rejectedAudit: RejectionAudit,
    handler: (tx: Tx, requestHash: string) => Promise<JsonObject>,
  ): Promise<JsonObject> {
    const requestHash = hash(content);
    const replay = async () => {
      const prior = await this.prisma.safetyCommand.findUnique({
        where: { actorUserId_clientRequestId: { actorUserId, clientRequestId } },
      });
      if (!prior) return null;
      if (prior.requestHash !== requestHash || prior.action !== action)
        throw SafetyError.requestConflict();
      const result = prior.result as JsonObject;
      this.throwStoredError(result);
      return result;
    };
    try {
      const existing = await replay();
      if (existing) return existing;
      const result = await this.prisma.$transaction(async (tx) => {
        const prior = await tx.safetyCommand.findUnique({
          where: { actorUserId_clientRequestId: { actorUserId, clientRequestId } },
        });
        if (prior) {
          if (prior.requestHash !== requestHash || prior.action !== action)
            throw SafetyError.requestConflict();
          return prior.result as JsonObject;
        }
        const output = await handler(tx, requestHash);
        await tx.safetyCommand.create({
          data: {
            id: randomUUID(),
            actorUserId,
            clientRequestId,
            action,
            requestHash,
            resourceType: String(output.resourceType),
            resourceId: String(output.resourceId),
            result: output as Prisma.InputJsonValue,
          },
        });
        return output;
      });
      this.throwStoredError(result);
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const stored = await replay();
        if (stored) return stored;
      }
      if (error instanceof SafetyError && error.code !== 'LAST_PLATFORM_ADMIN_REQUIRED') {
        await this.prisma.$transaction(async (tx) => {
          const roles = await this.currentRoles(tx, actorUserId);
          if (!roles.length && !rejectedAudit.includeOrdinaryUser) return;
          await appendBackofficeAuditEvent(tx, {
            actorType: 'USER',
            actorUserId,
            actorRoles: roles,
            action: rejectedAudit.action,
            targetType: rejectedAudit.targetType,
            ...(rejectedAudit.targetId ? { targetId: rejectedAudit.targetId } : {}),
            result: 'REJECTED',
            ...(rejectedAudit.requestId ? { requestId: rejectedAudit.requestId } : {}),
            details: { errorCode: error.code, clientRequestId },
          });
        });
      }
      throw error;
    }
  }

  private throwStoredError(result: JsonObject): void {
    if (result.errorCode === 'LAST_PLATFORM_ADMIN_REQUIRED') throw SafetyError.lastAdmin();
  }

  async claim(input: SafetyCommandInput) {
    const content = caseCommandContent({ action: 'CLAIM', caseId: input.caseId });
    return this.runCommand(
      input.actor.userId,
      input.clientRequestId,
      'CLAIM',
      content,
      {
        action: 'SAFETY_CASE_CLAIMED',
        targetType: 'SAFETY_CASE',
        targetId: input.caseId,
        ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
      },
      async (tx, requestHash) => {
        const roles = await this.officer(tx, input.actor.userId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "SafetyCase" WHERE "id"=${input.caseId}::uuid FOR UPDATE`,
        );
        const row = await tx.safetyCase.findUnique({
          where: { id: input.caseId },
          include: { report: { select: { category: true } } },
        });
        if (!row) throw SafetyError.caseNotFound();
        if (row.status !== 'OPEN' || row.assigneeUserId !== null) throw SafetyError.stateConflict();
        const now = await databaseNow(tx);
        const saved = await tx.safetyCase.update({
          where: { id: row.id },
          data: { assigneeUserId: input.actor.userId, assignedAt: now, version: { increment: 1 } },
          include: { report: { select: { category: true } } },
        });
        await tx.safetyCaseActivity.create({
          data: {
            id: randomUUID(),
            caseId: row.id,
            type: 'CLAIMED',
            actorType: 'USER',
            actorUserId: input.actor.userId,
            assigneeUserId: input.actor.userId,
            occurredAt: now,
          },
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'USER',
          actorUserId: input.actor.userId,
          actorRoles: roles,
          action: 'SAFETY_CASE_CLAIMED',
          targetType: 'SAFETY_CASE',
          targetId: row.id,
          result: 'SUCCEEDED',
          clientRequestId: input.clientRequestId,
          requestHash,
          ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
        });
        return { resourceType: 'SAFETY_CASE', resourceId: row.id, case: caseDto(saved) };
      },
    ).then((result) => result.case);
  }

  async start(input: SafetyCommandInput) {
    const content = caseCommandContent({ action: 'START', caseId: input.caseId });
    return this.runCommand(
      input.actor.userId,
      input.clientRequestId,
      'START',
      content,
      {
        action: 'SAFETY_REVIEW_STARTED',
        targetType: 'SAFETY_CASE',
        targetId: input.caseId,
        ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
      },
      async (tx, requestHash) => {
        const roles = await this.officer(tx, input.actor.userId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "SafetyCase" WHERE "id"=${input.caseId}::uuid FOR UPDATE`,
        );
        const row = await tx.safetyCase.findUnique({ where: { id: input.caseId } });
        if (!row) throw SafetyError.caseNotFound();
        if (row.status !== 'OPEN' || row.assigneeUserId !== input.actor.userId)
          throw SafetyError.stateConflict();
        const now = await databaseNow(tx);
        const saved = await tx.safetyCase.update({
          where: { id: row.id },
          data: { status: 'UNDER_REVIEW', reviewStartedAt: now, version: { increment: 1 } },
          include: { report: { select: { category: true } } },
        });
        await tx.safetyCaseActivity.create({
          data: {
            id: randomUUID(),
            caseId: row.id,
            type: 'REVIEW_STARTED',
            actorType: 'USER',
            actorUserId: input.actor.userId,
            fromStatus: 'OPEN',
            toStatus: 'UNDER_REVIEW',
            occurredAt: now,
          },
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'USER',
          actorUserId: input.actor.userId,
          actorRoles: roles,
          action: 'SAFETY_REVIEW_STARTED',
          targetType: 'SAFETY_CASE',
          targetId: row.id,
          result: 'SUCCEEDED',
          clientRequestId: input.clientRequestId,
          requestHash,
          ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
        });
        return { resourceType: 'SAFETY_CASE', resourceId: row.id, case: caseDto(saved) };
      },
    ).then((result) => result.case);
  }

  async dismiss(input: Required<SafetyCommandInput>) {
    const reason = normalizeSafetyReason(input.reason);
    const content = caseCommandContent({ action: 'DISMISS', caseId: input.caseId, reason });
    return this.runCommand(
      input.actor.userId,
      input.clientRequestId,
      'DISMISS',
      content,
      {
        action: 'SAFETY_CASE_DISMISSED',
        targetType: 'SAFETY_CASE',
        targetId: input.caseId,
        ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
      },
      async (tx, requestHash) => {
        const roles = await this.officer(tx, input.actor.userId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "SafetyCase" WHERE "id"=${input.caseId}::uuid FOR UPDATE`,
        );
        const row = await tx.safetyCase.findUnique({ where: { id: input.caseId } });
        if (!row) throw SafetyError.caseNotFound();
        if (row.status !== 'UNDER_REVIEW' || row.assigneeUserId !== input.actor.userId)
          throw SafetyError.stateConflict();
        const now = await databaseNow(tx);
        const saved = await tx.safetyCase.update({
          where: { id: row.id },
          data: {
            status: 'DISMISSED',
            decisionType: 'DISMISSED',
            decisionReason: reason,
            decidedAt: now,
            version: { increment: 1 },
          },
          include: { report: { select: { category: true } } },
        });
        await tx.safetyCaseActivity.create({
          data: {
            id: randomUUID(),
            caseId: row.id,
            type: 'DISMISSED',
            actorType: 'USER',
            actorUserId: input.actor.userId,
            fromStatus: 'UNDER_REVIEW',
            toStatus: 'DISMISSED',
            reason,
            occurredAt: now,
          },
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'USER',
          actorUserId: input.actor.userId,
          actorRoles: roles,
          action: 'SAFETY_CASE_DISMISSED',
          targetType: 'SAFETY_CASE',
          targetId: row.id,
          reason,
          result: 'SUCCEEDED',
          clientRequestId: input.clientRequestId,
          requestHash,
          ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
        });
        return { resourceType: 'SAFETY_CASE', resourceId: row.id, case: caseDto(saved) };
      },
    ).then((result) => result.case);
  }

  async resolve(input: SafetyResolveInput & { reason: string }) {
    const reason = normalizeSafetyReason(input.reason);
    validateResolution(input);
    const content = caseCommandContent({
      action: 'RESOLVE',
      caseId: input.caseId,
      reason,
      resolution: input.resolution,
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.factsConfirmed !== undefined ? { factsConfirmed: input.factsConfirmed } : {}),
    });
    return this.runCommand(
      input.actor.userId,
      input.clientRequestId,
      'RESOLVE',
      content,
      {
        action:
          input.resolution === 'PERMANENT_DISABLE'
            ? 'SAFETY_ACCOUNT_DISABLED'
            : input.resolution === 'TEMPORARY_RESTRICTION'
              ? 'SAFETY_RESTRICTION_CREATED'
              : 'SAFETY_CASE_RESOLVED',
        targetType: input.resolution === 'PERMANENT_DISABLE' ? 'USER' : 'SAFETY_CASE',
        targetId: input.caseId,
        ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
      },
      async (tx, requestHash) => {
        const roles = await this.officer(tx, input.actor.userId);
        if (input.resolution === 'PERMANENT_DISABLE') await lockPlatformAdminSet(tx);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "SafetyCase" WHERE "id"=${input.caseId}::uuid FOR UPDATE`,
        );
        const row = await tx.safetyCase.findUnique({ where: { id: input.caseId } });
        if (!row) throw SafetyError.caseNotFound();
        if (row.status !== 'UNDER_REVIEW' || row.assigneeUserId !== input.actor.userId)
          throw SafetyError.stateConflict();
        const now = await databaseNow(tx);
        let restriction: JsonObject | null = null;
        if (input.resolution === 'PERMANENT_DISABLE') {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${row.targetUserId}::uuid FOR UPDATE`,
          );
          const targetIsAdmin = await tx.backofficeRoleAssignment.count({
            where: {
              userId: row.targetUserId,
              role: 'PLATFORM_ADMIN',
              revokedAt: null,
              user: { status: 'ACTIVE' },
            },
          });
          if (targetIsAdmin) {
            const admins = await tx.backofficeRoleAssignment.count({
              where: { role: 'PLATFORM_ADMIN', revokedAt: null, user: { status: 'ACTIVE' } },
            });
            if (admins <= 1) {
              await appendBackofficeAuditEvent(tx, {
                actorType: 'USER',
                actorUserId: input.actor.userId,
                actorRoles: roles,
                action: 'SAFETY_ACCOUNT_DISABLED',
                targetType: 'USER',
                targetId: row.targetUserId,
                reason,
                result: 'REJECTED',
                clientRequestId: input.clientRequestId,
                requestHash,
                ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
              });
              return {
                resourceType: 'SAFETY_CASE',
                resourceId: row.id,
                errorCode: 'LAST_PLATFORM_ADMIN_REQUIRED',
              };
            }
          }
        }
        if (input.resolution !== 'NO_ACTION') {
          const severity = input.severity!;
          const temporary = input.resolution === 'TEMPORARY_RESTRICTION';
          const saved = await tx.safetyRestriction.create({
            data: {
              id: randomUUID(),
              caseId: row.id,
              userId: row.targetUserId,
              kind: temporary ? 'TEMPORARY' : 'PERMANENT',
              severity,
              reason,
              decidedByUserId: input.actor.userId,
              startsAt: now,
              endsAt: temporary ? restrictionEndsAt(severity, now) : null,
              appealDeadlineAt: temporary ? appealDeadline(now) : null,
            },
            include: { appeal: { select: { status: true } } },
          });
          restriction = restrictionDto(saved, now);
          if (!temporary) {
            await tx.user.update({ where: { id: row.targetUserId }, data: { status: 'DISABLED' } });
            await tx.authSession.updateMany({
              where: { userId: row.targetUserId, revokedAt: null },
              data: { revokedAt: now },
            });
          }
        }
        const savedCase = await tx.safetyCase.update({
          where: { id: row.id },
          data: {
            status: 'RESOLVED',
            assessedSeverity: input.severity ?? null,
            decisionType: input.resolution,
            decisionReason: reason,
            decidedAt: now,
            version: { increment: 1 },
          },
          include: { report: { select: { category: true } } },
        });
        await tx.safetyCaseActivity.create({
          data: {
            id: randomUUID(),
            caseId: row.id,
            type: 'RESOLVED',
            actorType: 'USER',
            actorUserId: input.actor.userId,
            fromStatus: 'UNDER_REVIEW',
            toStatus: 'RESOLVED',
            reason,
            occurredAt: now,
          },
        });
        const action =
          input.resolution === 'TEMPORARY_RESTRICTION'
            ? 'SAFETY_RESTRICTION_CREATED'
            : input.resolution === 'PERMANENT_DISABLE'
              ? 'SAFETY_ACCOUNT_DISABLED'
              : 'SAFETY_CASE_RESOLVED';
        await appendBackofficeAuditEvent(tx, {
          actorType: 'USER',
          actorUserId: input.actor.userId,
          actorRoles: roles,
          action,
          targetType: input.resolution === 'PERMANENT_DISABLE' ? 'USER' : 'SAFETY_CASE',
          targetId: input.resolution === 'PERMANENT_DISABLE' ? row.targetUserId : row.id,
          reason,
          result: 'SUCCEEDED',
          clientRequestId: input.clientRequestId,
          requestHash,
          ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
          details: { resolution: input.resolution, severity: input.severity ?? null },
        });
        return {
          resourceType: 'SAFETY_CASE',
          resourceId: row.id,
          case: caseDto(savedCase),
          restriction,
        };
      },
    ).then((result) => ({ case: result.case, restriction: result.restriction ?? null }));
  }

  async listRestrictions(
    actor: SafetyActor,
    input: { userId?: string; cursor?: string; limit: number },
  ) {
    const cursor = decodeCursor(input.cursor);
    return this.prisma.$transaction(async (tx) => {
      const roles = await this.officer(tx, actor.userId);
      const now = await databaseNow(tx);
      const rows = await tx.safetyRestriction.findMany({
        where: {
          ...(input.userId ? { userId: input.userId } : {}),
          ...(cursor
            ? {
                OR: [
                  { startsAt: { lt: new Date(cursor.at) } },
                  { startsAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        include: { appeal: { select: { status: true } } },
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: actor.userId,
        actorRoles: roles,
        action: 'SAFETY_RESTRICTIONS_VIEWED',
        targetType: 'SAFETY_RESTRICTION_LIST',
        result: 'SUCCEEDED',
        ...(actor.requestId ? { requestId: actor.requestId } : {}),
        details: { filtered: Boolean(input.userId) },
      });
      const items = rows.slice(0, input.limit);
      const last = items.at(-1);
      return {
        items: items.map((row) => restrictionDto(row, now)),
        nextCursor:
          rows.length > input.limit && last
            ? encodeCursor({ at: last.startsAt.toISOString(), id: last.id })
            : null,
      };
    });
  }

  async listOwnRestrictions(userId: string, input: { cursor?: string; limit: number }) {
    const cursor = decodeCursor(input.cursor);
    return this.prisma.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const rows = await tx.safetyRestriction.findMany({
        where: {
          userId,
          ...(cursor
            ? {
                OR: [
                  { startsAt: { lt: new Date(cursor.at) } },
                  { startsAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        include: { appeal: { select: { status: true } } },
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
      });
      const items = rows.slice(0, input.limit);
      const last = items.at(-1);
      return {
        items: items.map((row) => ownRestrictionDto(row, now)),
        nextCursor:
          rows.length > input.limit && last
            ? encodeCursor({ at: last.startsAt.toISOString(), id: last.id })
            : null,
      };
    });
  }

  async lift(input: {
    actor: SafetyActor;
    restrictionId: string;
    clientRequestId: string;
    reason: string;
  }) {
    const reason = normalizeSafetyReason(input.reason);
    const content = JSON.stringify({ action: 'LIFT', restrictionId: input.restrictionId, reason });
    return this.runCommand(
      input.actor.userId,
      input.clientRequestId,
      'LIFT',
      content,
      {
        action: 'SAFETY_RESTRICTION_LIFTED',
        targetType: 'SAFETY_RESTRICTION',
        targetId: input.restrictionId,
        ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
      },
      async (tx, requestHash) => {
        const roles = await this.officer(tx, input.actor.userId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "SafetyRestriction" WHERE "id"=${input.restrictionId}::uuid FOR UPDATE`,
        );
        const row = await tx.safetyRestriction.findUnique({ where: { id: input.restrictionId } });
        if (!row) throw SafetyError.restrictionNotFound();
        const now = await databaseNow(tx);
        if (row.kind !== 'TEMPORARY' || row.liftedAt || row.endsAt! <= now)
          throw SafetyError.stateConflict();
        const saved = await tx.safetyRestriction.update({
          where: { id: row.id },
          data: {
            status: 'LIFTED',
            liftedAt: now,
            liftedByUserId: input.actor.userId,
            liftReason: reason,
            version: { increment: 1 },
          },
          include: { appeal: { select: { status: true } } },
        });
        await tx.safetyCaseActivity.create({
          data: {
            id: randomUUID(),
            caseId: row.caseId,
            type: 'RESTRICTION_LIFTED',
            actorType: 'USER',
            actorUserId: input.actor.userId,
            reason,
            occurredAt: now,
          },
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'USER',
          actorUserId: input.actor.userId,
          actorRoles: roles,
          action: 'SAFETY_RESTRICTION_LIFTED',
          targetType: 'SAFETY_RESTRICTION',
          targetId: row.id,
          reason,
          result: 'SUCCEEDED',
          clientRequestId: input.clientRequestId,
          requestHash,
          ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
        });
        return {
          resourceType: 'SAFETY_RESTRICTION',
          resourceId: row.id,
          restriction: restrictionDto(saved, now),
        };
      },
    ).then((result) => result.restriction);
  }

  async appeal(input: {
    userId: string;
    restrictionId: string;
    clientRequestId: string;
    reason: string;
    requestId?: string;
  }) {
    const reason = normalizeSafetyReason(input.reason, 2000);
    const content = appealCommandContent({
      action: 'APPEAL',
      restrictionId: input.restrictionId,
      reason,
    });
    return this.runCommand(
      input.userId,
      input.clientRequestId,
      'APPEAL',
      content,
      {
        action: 'SAFETY_APPEAL_SUBMITTED',
        targetType: 'SAFETY_RESTRICTION',
        targetId: input.restrictionId,
        includeOrdinaryUser: true,
        ...(input.requestId ? { requestId: input.requestId } : {}),
      },
      async (tx, requestHash) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "SafetyRestriction" WHERE "id"=${input.restrictionId}::uuid FOR UPDATE`,
        );
        const restriction = await tx.safetyRestriction.findUnique({
          where: { id: input.restrictionId },
          include: { appeal: true },
        });
        if (!restriction || restriction.userId !== input.userId)
          throw SafetyError.restrictionNotFound();
        const now = await databaseNow(tx);
        if (
          restriction.kind !== 'TEMPORARY' ||
          restriction.status !== 'ACTIVE' ||
          restriction.liftedAt ||
          restriction.endsAt! <= now ||
          now > restriction.appealDeadlineAt!
        )
          throw SafetyError.appealClosed();
        if (restriction.appeal) throw SafetyError.stateConflict();
        const saved = await tx.safetyAppeal.create({
          data: {
            id: randomUUID(),
            restrictionId: restriction.id,
            userId: input.userId,
            reason,
            submittedAt: now,
          },
        });
        await tx.safetyCaseActivity.create({
          data: {
            id: randomUUID(),
            caseId: restriction.caseId,
            type: 'APPEAL_SUBMITTED',
            actorType: 'USER',
            actorUserId: input.userId,
            occurredAt: now,
          },
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'USER',
          actorUserId: input.userId,
          actorRoles: [],
          action: 'SAFETY_APPEAL_SUBMITTED',
          targetType: 'SAFETY_APPEAL',
          targetId: saved.id,
          result: 'SUCCEEDED',
          clientRequestId: input.clientRequestId,
          requestHash,
          ...(input.requestId ? { requestId: input.requestId } : {}),
        });
        return { resourceType: 'SAFETY_APPEAL', resourceId: saved.id, appeal: appealDto(saved) };
      },
    ).then((result) => result.appeal);
  }

  async listAppeals(
    actor: SafetyActor,
    input: { status?: string; cursor?: string; limit: number },
  ) {
    const cursor = decodeCursor(input.cursor);
    return this.prisma.$transaction(async (tx) => {
      const roles = await this.officer(tx, actor.userId);
      const rows = await tx.safetyAppeal.findMany({
        where: {
          ...(input.status ? { status: input.status as PrismaSafetyAppealStatus } : {}),
          ...(cursor
            ? {
                OR: [
                  { submittedAt: { lt: new Date(cursor.at) } },
                  { submittedAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: actor.userId,
        actorRoles: roles,
        action: 'SAFETY_APPEALS_VIEWED',
        targetType: 'SAFETY_APPEAL_LIST',
        result: 'SUCCEEDED',
        ...(actor.requestId ? { requestId: actor.requestId } : {}),
        details: { filtered: Boolean(input.status) },
      });
      const items = rows.slice(0, input.limit);
      const last = items.at(-1);
      return {
        items: items.map(appealDto),
        nextCursor:
          rows.length > input.limit && last
            ? encodeCursor({ at: last.submittedAt.toISOString(), id: last.id })
            : null,
      };
    });
  }

  async decideAppeal(input: {
    actor: SafetyActor;
    appealId: string;
    clientRequestId: string;
    decision: SafetyAppealDecision;
    reason: string;
  }) {
    const reason = normalizeSafetyReason(input.reason);
    const content = appealCommandContent({
      action: 'DECIDE_APPEAL',
      appealId: input.appealId,
      decision: input.decision,
      reason,
    });
    return this.runCommand(
      input.actor.userId,
      input.clientRequestId,
      'DECIDE_APPEAL',
      content,
      {
        action: 'SAFETY_APPEAL_DECIDED',
        targetType: 'SAFETY_APPEAL',
        targetId: input.appealId,
        ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
      },
      async (tx, requestHash) => {
        const roles = await this.officer(tx, input.actor.userId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "SafetyAppeal" WHERE "id"=${input.appealId}::uuid FOR UPDATE`,
        );
        const row = await tx.safetyAppeal.findUnique({
          where: { id: input.appealId },
          include: { restriction: true },
        });
        if (!row) throw SafetyError.appealNotFound();
        if (row.status !== 'PENDING') throw SafetyError.stateConflict();
        const now = await databaseNow(tx);
        if (input.decision === 'LIFTED') {
          if (
            row.restriction.kind !== 'TEMPORARY' ||
            row.restriction.liftedAt ||
            row.restriction.endsAt! <= now
          )
            throw SafetyError.stateConflict();
          await tx.safetyRestriction.update({
            where: { id: row.restrictionId },
            data: {
              status: 'LIFTED',
              liftedAt: now,
              liftedByUserId: input.actor.userId,
              liftReason: reason,
              version: { increment: 1 },
            },
          });
        }
        const saved = await tx.safetyAppeal.update({
          where: { id: row.id },
          data: {
            status: input.decision,
            decidedAt: now,
            decidedByUserId: input.actor.userId,
            decisionReason: reason,
          },
        });
        await tx.safetyCaseActivity.create({
          data: {
            id: randomUUID(),
            caseId: row.restriction.caseId,
            type: input.decision === 'LIFTED' ? 'APPEAL_LIFTED' : 'APPEAL_UPHELD',
            actorType: 'USER',
            actorUserId: input.actor.userId,
            reason,
            occurredAt: now,
          },
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'USER',
          actorUserId: input.actor.userId,
          actorRoles: roles,
          action: 'SAFETY_APPEAL_DECIDED',
          targetType: 'SAFETY_APPEAL',
          targetId: row.id,
          reason,
          result: 'SUCCEEDED',
          clientRequestId: input.clientRequestId,
          requestHash,
          ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
          details: { decision: input.decision },
        });
        return { resourceType: 'SAFETY_APPEAL', resourceId: row.id, appeal: appealDto(saved) };
      },
    ).then((result) => result.appeal);
  }

  async expire(restrictionId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "SafetyRestriction" WHERE "id"=${restrictionId}::uuid FOR UPDATE`,
      );
      const row = await tx.safetyRestriction.findUnique({ where: { id: restrictionId } });
      if (!row) return false;
      const now = await databaseNow(tx);
      if (
        row.kind !== 'TEMPORARY' ||
        row.status !== 'ACTIVE' ||
        row.liftedAt ||
        !row.endsAt ||
        row.endsAt > now
      )
        return false;
      await tx.safetyRestriction.update({
        where: { id: row.id },
        data: { status: 'EXPIRED', expiredAt: now, version: { increment: 1 } },
      });
      await tx.safetyCaseActivity.create({
        data: {
          id: randomUUID(),
          caseId: row.caseId,
          type: 'RESTRICTION_EXPIRED',
          actorType: 'SYSTEM_JOB',
          occurredAt: now,
        },
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'SYSTEM_JOB',
        actorRoles: [],
        action: 'SAFETY_RESTRICTION_EXPIRED',
        targetType: 'SAFETY_RESTRICTION',
        targetId: row.id,
        result: 'SUCCEEDED',
      });
      return true;
    });
  }

  async recoverAssignments(): Promise<number> {
    const candidates = await this.prisma.safetyCase.findMany({
      where: {
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
        OR: [
          { assigneeUserId: null },
          {
            assignee: {
              OR: [
                { status: { not: 'ACTIVE' } },
                { backofficeRoles: { none: { role: 'SAFETY_OFFICER', revokedAt: null } } },
              ],
            },
          },
        ],
      },
      select: { id: true, assigneeUserId: true },
      take: 100,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    let changed = 0;
    for (const candidate of candidates) {
      const assigned = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "SafetyCase" WHERE "id"=${candidate.id}::uuid FOR UPDATE`,
        );
        const current = await tx.safetyCase.findUnique({
          where: { id: candidate.id },
          include: {
            assignee: {
              select: {
                status: true,
                backofficeRoles: {
                  where: { role: 'SAFETY_OFFICER', revokedAt: null },
                  select: { id: true },
                },
              },
            },
          },
        });
        if (!current || !['OPEN', 'UNDER_REVIEW'].includes(current.status)) return null;
        const valid =
          current.assignee?.status === 'ACTIVE' && current.assignee.backofficeRoles.length > 0;
        if (valid) return null;
        if (current.assigneeUserId)
          await tx.safetyCase.update({
            where: { id: current.id },
            data: { assigneeUserId: null, assignedAt: null, version: { increment: 1 } },
          });
        return assignSafetyCase(tx, current.id, current.assigneeUserId ? 'REASSIGNED' : 'ASSIGNED');
      });
      if (assigned) changed += 1;
    }
    return changed;
  }

  recoverableRestrictionIds() {
    return this.prisma.safetyRestriction
      .findMany({
        where: { kind: 'TEMPORARY', status: 'ACTIVE', liftedAt: null, endsAt: { not: null } },
        select: { id: true, endsAt: true },
        orderBy: { endsAt: 'asc' },
        take: 100,
      })
      .then((rows) =>
        rows.filter((row): row is { id: string; endsAt: Date } => row.endsAt !== null),
      );
  }
}
