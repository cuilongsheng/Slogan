import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { appendBackofficeAuditEvent } from '../audit/persistence.js';

export interface EffectiveSafetyRestriction {
  severity: 'GENERAL' | 'SERIOUS' | 'HIGH_RISK';
  endsAt: Date;
  restrictionIds: string[];
}

export async function databaseNow(tx: Prisma.TransactionClient): Promise<Date> {
  const [row] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  return row?.now ?? new Date();
}

export async function readEffectiveSafetyRestriction(
  tx: Prisma.TransactionClient,
  userId: string,
  now?: Date,
): Promise<EffectiveSafetyRestriction | null> {
  const at = now ?? (await databaseNow(tx));
  const rows = await tx.safetyRestriction.findMany({
    where: {
      userId,
      kind: 'TEMPORARY',
      status: 'ACTIVE',
      liftedAt: null,
      startsAt: { lte: at },
      endsAt: { gt: at },
    },
    select: { id: true, severity: true, endsAt: true },
  });
  if (!rows.length) return null;
  const order = { GENERAL: 0, SERIOUS: 1, HIGH_RISK: 2 } as const;
  const severity = rows.reduce(
    (highest, row) => (order[row.severity] > order[highest] ? row.severity : highest),
    rows[0]!.severity,
  );
  const endsAt = rows.reduce(
    (latest, row) => (row.endsAt! > latest ? row.endsAt! : latest),
    rows[0]!.endsAt!,
  );
  return { severity, endsAt, restrictionIds: rows.map((row) => row.id).sort() };
}

export async function assignSafetyCase(
  tx: Prisma.TransactionClient,
  caseId: string,
  activity: 'ASSIGNED' | 'REASSIGNED' = 'ASSIGNED',
): Promise<string | null> {
  await tx.safetyAssignmentState.upsert({
    where: { key: 'GLOBAL' },
    create: { key: 'GLOBAL' },
    update: {},
  });
  await tx.$queryRaw`SELECT "key" FROM "SafetyAssignmentState" WHERE "key" = 'GLOBAL' FOR UPDATE`;
  const state = await tx.safetyAssignmentState.findUniqueOrThrow({ where: { key: 'GLOBAL' } });
  const officers = await tx.backofficeRoleAssignment.findMany({
    where: { role: 'SAFETY_OFFICER', revokedAt: null, user: { status: 'ACTIVE' } },
    select: { userId: true },
    orderBy: { userId: 'asc' },
  });
  if (!officers.length) return null;
  const workloads = await Promise.all(
    officers.map(async ({ userId }) => ({
      userId,
      count: await tx.safetyCase.count({
        where: { assigneeUserId: userId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
    })),
  );
  const minimum = Math.min(...workloads.map((entry) => entry.count));
  const tied = workloads.filter((entry) => entry.count === minimum).map((entry) => entry.userId);
  const after = state.lastAssigneeUserId
    ? tied.find((userId) => userId > state.lastAssigneeUserId!)
    : undefined;
  const assigneeUserId = after ?? tied[0]!;
  const now = await databaseNow(tx);
  const updated = await tx.safetyCase.updateMany({
    where: { id: caseId, status: { in: ['OPEN', 'UNDER_REVIEW'] }, assigneeUserId: null },
    data: { assigneeUserId, assignedAt: now, version: { increment: 1 } },
  });
  if (!updated.count) return null;
  await tx.safetyAssignmentState.update({
    where: { key: 'GLOBAL' },
    data: { lastAssigneeUserId: assigneeUserId },
  });
  await tx.safetyCaseActivity.create({
    data: {
      id: randomUUID(),
      caseId,
      type: activity,
      actorType: 'SYSTEM_JOB',
      assigneeUserId,
      occurredAt: now,
    },
  });
  await appendBackofficeAuditEvent(tx, {
    actorType: 'SYSTEM_JOB',
    actorRoles: [],
    action: 'SAFETY_CASE_ASSIGNED',
    targetType: 'SAFETY_CASE',
    targetId: caseId,
    result: 'SUCCEEDED',
    details: { assigneeUserId, activity },
  });
  return assigneeUserId;
}

export async function createSafetyCaseForReport(
  tx: Prisma.TransactionClient,
  input: {
    reportId: string;
    roomId: string;
    targetUserId: string;
    submittedAt: Date;
  },
): Promise<string> {
  const id = randomUUID();
  await tx.safetyCase.create({
    data: {
      id,
      reportId: input.reportId,
      roomId: input.roomId,
      targetUserId: input.targetUserId,
      createdAt: input.submittedAt,
      updatedAt: input.submittedAt,
    },
  });
  const memberships = await tx.roomMembership.findMany({
    where: { roomId: input.roomId, joinedAt: { lte: input.submittedAt } },
    select: {
      userId: true,
      role: true,
      lifecycle: true,
      joinedAt: true,
      leftAt: true,
      removedAt: true,
    },
  });
  if (memberships.length)
    await tx.safetyCaseParticipantSnapshot.createMany({
      data: memberships.map((member) => ({
        id: randomUUID(),
        caseId: id,
        capturedAt: input.submittedAt,
        ...member,
      })),
    });
  await tx.safetyCaseActivity.create({
    data: {
      id: randomUUID(),
      caseId: id,
      type: 'CREATED',
      actorType: 'SYSTEM_JOB',
      toStatus: 'OPEN',
      occurredAt: input.submittedAt,
    },
  });
  await appendBackofficeAuditEvent(tx, {
    actorType: 'SYSTEM_JOB',
    actorRoles: [],
    action: 'SAFETY_CASE_CREATED',
    targetType: 'SAFETY_CASE',
    targetId: id,
    result: 'SUCCEEDED',
    details: { reportId: input.reportId },
  });
  const assigned = await assignSafetyCase(tx, id);
  if (!assigned) {
    await tx.safetyCaseActivity.create({
      data: {
        id: randomUUID(),
        caseId: id,
        type: 'UNASSIGNED',
        actorType: 'SYSTEM_JOB',
        fromStatus: 'OPEN',
        toStatus: 'OPEN',
        occurredAt: input.submittedAt,
      },
    });
  }
  return id;
}
