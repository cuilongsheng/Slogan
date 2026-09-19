import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { appendBackofficeAuditEvent } from '../../audit/index.js';
import type {
  MetricFact,
  MetricSnapshotQuery,
  MetricSnapshotView,
  MetricWindow,
} from '../domain/entities/operations.js';
import type {
  MetricRunClaim,
  MetricsRepository,
} from '../domain/ports/metrics.repository.js';
import { normalizeDimensions, ratio } from '../domain/policies/operations.policy.js';

type Cursor = { at: string; id: string };
type ActivityCursor = { count: number; userId: string };
type CountRow = { count: bigint };
type DurationRow = { id: string; userId: string; type: string; occurredAt: Date };

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function decode(value?: string): Cursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (!parsed.id || Number.isNaN(new Date(parsed.at).getTime())) throw new Error();
    return parsed;
  } catch {
    throw new Error('OPERATIONS_CURSOR_INVALID');
  }
}
function decodeActivity(value?: string): ActivityCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as ActivityCursor;
    if (!parsed.userId || !Number.isInteger(parsed.count) || parsed.count < 0) throw new Error();
    return parsed;
  } catch {
    throw new Error('OPERATIONS_CURSOR_INVALID');
  }
}

@Injectable()
export class PrismaMetricsRepository implements MetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claim(
    window: MetricWindow,
    definitionVersion: string,
    leaseSeconds: number,
  ): Promise<MetricRunClaim> {
    const now = new Date();
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.metricComputationRun.upsert({
          where: {
            grain_windowStart_windowEnd_definitionVersion: {
              grain: window.grain,
              windowStart: window.start,
              windowEnd: window.end,
              definitionVersion,
            },
          },
          create: {
            id: randomUUID(),
            grain: window.grain,
            windowStart: window.start,
            windowEnd: window.end,
            definitionVersion,
          },
          update: {},
        });
        await tx.$queryRaw`SELECT 1 FROM "MetricComputationRun" WHERE "id" = ${existing.id}::uuid FOR UPDATE`;
        const current = await tx.metricComputationRun.findUniqueOrThrow({ where: { id: existing.id } });
        if (current.status === 'RUNNING' && current.lockedUntil && current.lockedUntil > now)
          throw new Error('METRIC_RUN_BUSY');
        const leaseId = randomUUID();
        const generation = current.generation + 1;
        await tx.metricComputationRun.update({
          where: { id: current.id },
          data: {
            status: 'RUNNING',
            generation,
            leaseId,
            lockedUntil: new Date(now.getTime() + leaseSeconds * 1000),
            startedAt: now,
            completedAt: null,
            errorCode: null,
          },
        });
        return { runId: current.id, leaseId, generation, window, definitionVersion };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async compute(window: MetricWindow, now: Date): Promise<MetricFact[]> {
    const [
      cohort,
      profiles,
      firstActions,
      firstConnections,
      events,
      endedRooms,
      aiDenominator,
      aiNumerator,
      postRoomDenominator,
      postRoomNumerator,
      shareOpened,
      shareJoined,
      appointmentDenominator,
      appointmentNumerator,
      decidedCases,
      repeatRiskUsers,
      reportDenominator,
      hostHandled,
      dismissedCases,
    ] = await Promise.all([
      this.count`SELECT COUNT(*)::bigint AS count FROM "User" WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end}`,
      this.count`SELECT COUNT(*)::bigint AS count FROM "UserProfile" p JOIN "User" u ON u.id=p."userId" WHERE u."createdAt" >= ${window.start} AND u."createdAt" < ${window.end}`,
      this.count`SELECT COUNT(*)::bigint AS count FROM (SELECT "userId" FROM "RoomMembership" GROUP BY "userId" HAVING MIN("joinedAt") >= ${window.start} AND MIN("joinedAt") < ${window.end}) s`,
      this.count`SELECT COUNT(*)::bigint AS count FROM (SELECT m."userId" FROM "RoomEvent" e JOIN "RoomMembership" m ON m.id=e."targetId" WHERE e.type='joined' GROUP BY m."userId" HAVING MIN(e."occurredAt") >= ${window.start} AND MIN(e."occurredAt") < ${window.end}) s`,
      this.prisma.$queryRaw<DurationRow[]>`
        SELECT m.id, m."userId", e.type, e."occurredAt"
        FROM "RoomEvent" e JOIN "RoomMembership" m ON m.id=e."targetId"
        WHERE e.type IN ('joined','left','aborted') AND e."occurredAt" >= ${window.start} AND e."occurredAt" < ${window.end}
        ORDER BY m.id, e."occurredAt", e.id`,
      this.prisma.room.findMany({
        where: { endedAt: { gte: window.start, lt: window.end }, status: 'ENDED' },
        select: { startedAt: true, endedAt: true },
      }),
      this.prisma.aiExpressionRequest.findMany({
        where: { status: 'SUCCEEDED', finishedAt: { gte: window.start, lt: window.end } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.count`SELECT COUNT(DISTINCT a."userId")::bigint AS count FROM "AiExpressionRequest" a WHERE a.status='SUCCEEDED' AND a."finishedAt" >= ${window.start} AND a."finishedAt" < ${window.end} AND EXISTS (SELECT 1 FROM "RoomMembership" m JOIN "RoomEvent" e ON e."targetId"=m.id WHERE m."userId"=a."userId" AND m."roomId"=a."roomId" AND e.type='joined' AND e."occurredAt" >= a."finishedAt")`,
      this.count`SELECT COUNT(DISTINCT m."userId")::bigint AS count FROM "RoomMembership" m JOIN "Room" r ON r.id=m."roomId" WHERE r."endedAt" >= ${window.start} AND r."endedAt" < ${window.end}`,
      this.count`SELECT COUNT(DISTINCT "userId")::bigint AS count FROM "VocabularyItem" WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end}`,
      this.prisma.roomShareAttribution.count({ where: { openedAt: { gte: window.start, lt: window.end } } }),
      this.prisma.roomShareAttribution.count({
        where: { openedAt: { gte: window.start, lt: window.end }, joinedAt: { not: null } },
      }),
      this.prisma.roomReservation.count({
        where: {
          bookedAt: { gte: window.start, lt: window.end },
          status: { in: ['BOOKED', 'CONSUMED'] },
        },
      }),
      this.prisma.roomReservation.count({
        where: { bookedAt: { gte: window.start, lt: window.end }, status: 'CONSUMED' },
      }),
      this.prisma.safetyCase.findMany({
        where: { decidedAt: { gte: window.start, lt: window.end } },
        select: { createdAt: true, decidedAt: true, status: true },
      }),
      this.count`SELECT COUNT(*)::bigint AS count FROM (SELECT "targetUserId" FROM "Report" WHERE "submittedAt" >= ${window.start} AND "submittedAt" < ${window.end} GROUP BY "targetUserId" HAVING COUNT(*) > 1 UNION SELECT m."userId" FROM "RoomEvent" e JOIN "RoomMembership" m ON m.id=e."targetId" WHERE e.type='member_removed' AND e."occurredAt" >= ${window.start} AND e."occurredAt" < ${window.end} GROUP BY m."userId" HAVING COUNT(*) > 1) s`,
      this.prisma.report.count({ where: { submittedAt: { gte: window.start, lt: window.end } } }),
      this.count`SELECT COUNT(DISTINCT r.id)::bigint AS count FROM "Report" r WHERE r."submittedAt" >= ${window.start} AND r."submittedAt" < ${window.end} AND EXISTS (SELECT 1 FROM "RoomMembership" m JOIN "RoomEvent" e ON e."targetId"=m.id WHERE m."roomId"=r."roomId" AND m."userId"=r."targetUserId" AND e.type='member_removed' AND e."occurredAt" >= r."submittedAt")`,
      this.prisma.safetyCase.count({
        where: { decidedAt: { gte: window.start, lt: window.end }, status: 'DISMISSED' },
      }),
    ]);

    const durations = this.connectedDurations(events, window.end);
    const connectedUsers = new Set(events.filter((event) => event.type === 'joined').map((e) => e.userId));
    const effectiveUsers = new Set(
      [...durations.entries()].filter(([, milliseconds]) => milliseconds >= 300_000).map(([id]) => id),
    );
    const averageRoomSeconds =
      endedRooms.length === 0
        ? null
        : endedRooms.reduce(
            (sum, room) =>
              sum + Math.max(0, (room.endedAt?.getTime() ?? room.startedAt.getTime()) - room.startedAt.getTime()),
            0,
          ) /
          endedRooms.length /
          1000;
    const decidedDurations = decidedCases
      .filter((item) => item.decidedAt)
      .map((item) => item.decidedAt!.getTime() - item.createdAt.getTime());
    const safetySeconds =
      decidedDurations.length === 0
        ? null
        : decidedDurations.reduce((sum, duration) => sum + Math.max(0, duration), 0) /
          decidedDurations.length /
          1000;
    const returnBoundary = new Date(window.end.getTime() + 7 * 86_400_000);
    const baselineUsers = await this.prisma.roomMembership.findMany({
      where: { joinedAt: { gte: window.start, lt: window.end } },
      distinct: ['userId'],
      select: { userId: true },
    });
    const returners =
      now < returnBoundary
        ? []
        : await this.prisma.roomMembership.findMany({
            where: {
              userId: { in: baselineUsers.map((item) => item.userId) },
              joinedAt: { gte: window.end, lt: returnBoundary },
            },
            distinct: ['userId'],
            select: { userId: true },
          });

    const facts: MetricFact[] = [
      this.rate('PROFILE_COMPLETION_RATE', Number(profiles), Number(cohort)),
      this.rate('FIRST_ROOM_ACTION_RATE', Number(firstActions), Number(cohort)),
      this.rate('FIRST_VOICE_CONNECTION_RATE', Number(firstConnections), Number(cohort)),
      this.rate('FIVE_MINUTE_CONVERSATION_RATE', effectiveUsers.size, connectedUsers.size),
      this.value('AVERAGE_EFFECTIVE_ROOM_SECONDS', averageRoomSeconds, endedRooms.length),
      this.rate('AI_CONTINUATION_RATE', Number(aiNumerator), aiDenominator.length),
      this.rate('POST_ROOM_SAVE_RATE', Number(postRoomNumerator), Number(postRoomDenominator)),
      now < returnBoundary
        ? this.unavailable('SEVEN_DAY_RETURN_RATE', 'WINDOW_NOT_MATURE')
        : this.rate('SEVEN_DAY_RETURN_RATE', returners.length, baselineUsers.length),
      this.rate('SHARE_JOIN_CONVERSION_RATE', shareJoined, shareOpened),
      this.rate('APPOINTMENT_ATTENDANCE_RATE', appointmentNumerator, appointmentDenominator),
      this.value('SAFETY_CASE_RESOLUTION_SECONDS', safetySeconds, decidedDurations.length),
      this.value('REPEAT_REMOVED_OR_REPORTED_USERS', Number(repeatRiskUsers), Number(repeatRiskUsers)),
      this.rate('HOST_REPORT_COMPLETION_RATE', Number(hostHandled), reportDenominator),
      this.rate('DISMISSED_REPORT_RATE', dismissedCases, decidedCases.length),
    ];

    if (connectedUsers.size > 0) {
      const profilesForVoice = await this.prisma.userProfile.findMany({
        where: { userId: { in: [...connectedUsers] } },
        select: { userId: true, nationalityCode: true, cefrLevel: true },
      });
      for (const [dimension, selector] of [
        ['NATIONALITY', (item: (typeof profilesForVoice)[number]) => item.nationalityCode ?? 'UNKNOWN'],
        ['CEFR', (item: (typeof profilesForVoice)[number]) => item.cefrLevel],
      ] as const) {
        const groups = new Map<string, { numerator: number; denominator: number }>();
        for (const profile of profilesForVoice) {
          const key = selector(profile);
          const group = groups.get(key) ?? { numerator: 0, denominator: 0 };
          group.denominator += 1;
          if (effectiveUsers.has(profile.userId)) group.numerator += 1;
          groups.set(key, group);
        }
        for (const [key, group] of groups) {
          facts.push(
            this.rate('FIVE_MINUTE_CONVERSATION_RATE', group.numerator, group.denominator, {
              [dimension]: key,
            }),
          );
        }
      }
    }
    return facts;
  }

  async commit(claim: MetricRunClaim, facts: MetricFact[], dataThroughAt: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.metricComputationRun.updateMany({
        where: {
          id: claim.runId,
          leaseId: claim.leaseId,
          generation: claim.generation,
          status: 'RUNNING',
        },
        data: { status: 'COMPLETED', completedAt: new Date(), watermark: dataThroughAt, lockedUntil: null },
      });
      if (updated.count !== 1) throw new Error('METRIC_RUN_FENCED');
      await tx.metricSnapshot.deleteMany({ where: { runId: claim.runId } });
      await tx.metricSnapshot.createMany({
        data: facts.map((fact) => {
          const dimensions = normalizeDimensions(fact.dimensions);
          return {
            id: randomUUID(),
            runId: claim.runId,
            metricKey: fact.metricKey,
            grain: claim.window.grain,
            windowStart: claim.window.start,
            windowEnd: claim.window.end,
            dimensionKey: dimensions.key,
            dimensions: dimensions.value,
            definitionVersion: claim.definitionVersion,
            status: fact.status,
            value: fact.value,
            numerator: fact.numerator,
            denominator: fact.denominator,
            sampleSize: fact.sampleSize,
            reasonCode: fact.reasonCode ?? null,
            dataThroughAt,
          };
        }),
      });
    });
  }

  async fail(claim: MetricRunClaim, errorCode: string): Promise<void> {
    await this.prisma.metricComputationRun.updateMany({
      where: { id: claim.runId, leaseId: claim.leaseId, generation: claim.generation },
      data: { status: 'FAILED', errorCode, completedAt: new Date(), lockedUntil: null },
    });
  }

  async list(
    actorUserId: string,
    actorRoles: import('../../backoffice/index.js').BackofficeRole[],
    query: MetricSnapshotQuery,
    requestId?: string,
  ) {
    const cursor = decode(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.metricSnapshot.findMany({
        where: {
          windowStart: { gte: query.from, lt: query.to },
          ...(query.grain ? { grain: query.grain } : {}),
          ...(query.metricKey ? { metricKey: query.metricKey } : {}),
          ...(query.dimension ? { dimensionKey: { contains: `\"${query.dimension}\"` } } : {}),
          ...(cursor
            ? {
                OR: [
                  { windowStart: { lt: new Date(cursor.at) } },
                  { windowStart: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ windowStart: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId,
        actorRoles,
        action: 'OPERATIONS_METRICS_VIEWED',
        targetType: 'METRIC_SNAPSHOT',
        reason: 'aggregate metrics query',
        result: 'SUCCEEDED',
        ...(requestId ? { requestId } : {}),
        details: {
          grain: query.grain ?? null,
          metricKey: query.metricKey ?? null,
          dimension: query.dimension ?? null,
          limit: query.limit,
        },
      });
      const page = rows.slice(0, query.limit);
      return {
        items: page.map((row): MetricSnapshotView => ({
          id: row.id,
          metricKey: row.metricKey as MetricSnapshotView['metricKey'],
          grain: row.grain,
          windowStart: row.windowStart,
          windowEnd: row.windowEnd,
          dimensions: row.dimensions as Record<string, string>,
          definitionVersion: row.definitionVersion,
          status: row.status,
          value: row.value === null ? null : Number(row.value),
          numerator: row.numerator,
          denominator: row.denominator,
          sampleSize: row.sampleSize,
          ...(row.reasonCode ? { reasonCode: row.reasonCode } : {}),
          dataThroughAt: row.dataThroughAt,
          generatedAt: row.generatedAt,
          suppressed: false,
        })),
        nextCursor:
          rows.length > query.limit && page.at(-1)
            ? encode({ at: page.at(-1)!.windowStart.toISOString(), id: page.at(-1)!.id })
            : null,
      };
    });
  }

  async currentOnline() {
    const sampledAt = new Date();
    try {
      const value = await this.prisma.roomMembership.count({
        where: { presence: 'CONNECTED', lifecycle: 'ACTIVE', user: { status: 'ACTIVE' } },
      });
      return { value, sampledAt };
    } catch {
      return { value: null, sampledAt, reasonCode: 'PRESENCE_UNAVAILABLE' };
    }
  }

  async rooms(
    actorUserId: string,
    actorRoles: import('../../backoffice/index.js').BackofficeRole[],
    cursor: string | undefined,
    limit: number,
    requestId?: string,
  ) {
    const decoded = decode(cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.room.findMany({
        ...(decoded
          ? {
              where: {
                OR: [
                  { createdAt: { lt: new Date(decoded.at) } },
                  { createdAt: new Date(decoded.at), id: { lt: decoded.id } },
                ],
              },
            }
          : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: {
          id: true,
          kind: true,
          visibility: true,
          status: true,
          cefrLevel: true,
          capacity: true,
          startedAt: true,
          endsAt: true,
          endedAt: true,
          createdAt: true,
          _count: { select: { memberships: true, reservations: true, reports: true } },
        },
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId,
        actorRoles,
        action: 'OPERATIONS_DETAILS_VIEWED',
        targetType: 'ROOM_OPERATIONS',
        reason: 'room operations detail query',
        result: 'SUCCEEDED',
        ...(requestId ? { requestId } : {}),
        details: { limit },
      });
      const page = rows.slice(0, limit);
      return {
        items: page,
        nextCursor:
          rows.length > limit && page.at(-1)
            ? encode({ at: page.at(-1)!.createdAt.toISOString(), id: page.at(-1)!.id })
            : null,
      };
    });
  }

  async activeUsers(
    actorUserId: string,
    actorRoles: import('../../backoffice/index.js').BackofficeRole[],
    from: Date,
    to: Date,
    cursor: string | undefined,
    limit: number,
    requestId?: string,
  ) {
    const decoded = decodeActivity(cursor);
    return this.prisma.$transaction(async (tx) => {
      const after = decoded
        ? Prisma.sql`HAVING COUNT(*) < ${decoded.count} OR (COUNT(*) = ${decoded.count} AND m."userId" > ${decoded.userId}::uuid)`
        : Prisma.empty;
      const rows = await tx.$queryRaw<Array<{ userId: string; activityCount: bigint }>>(Prisma.sql`
        SELECT m."userId", COUNT(*)::bigint AS "activityCount"
        FROM "RoomMembership" m JOIN "User" u ON u.id=m."userId"
        WHERE m."joinedAt" >= ${from} AND m."joinedAt" < ${to} AND u.status='ACTIVE'
        GROUP BY m."userId"
        ${after}
        ORDER BY COUNT(*) DESC, m."userId" ASC
        LIMIT ${limit + 1}`);
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId,
        actorRoles,
        action: 'OPERATIONS_DETAILS_VIEWED',
        targetType: 'ACTIVE_USER_RANKING',
        reason: 'internal activity ranking query',
        result: 'SUCCEEDED',
        ...(requestId ? { requestId } : {}),
        details: { from: from.toISOString(), to: to.toISOString(), limit },
      });
      const page = rows.slice(0, limit).map((row) => ({
        userId: row.userId,
        activityCount: Number(row.activityCount),
      }));
      const last = page.at(-1);
      return {
        items: page,
        nextCursor:
          rows.length > limit && last
            ? encode({ count: last.activityCount, userId: last.userId })
            : null,
      };
    });
  }

  private async count(strings: TemplateStringsArray, ...values: unknown[]): Promise<bigint> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql(strings, ...values));
    return rows[0]?.count ?? 0n;
  }

  private connectedDurations(events: DurationRow[], end: Date): Map<string, number> {
    const starts = new Map<string, Date>();
    const totals = new Map<string, number>();
    for (const event of events) {
      if (event.type === 'joined') {
        if (!starts.has(event.id)) starts.set(event.id, event.occurredAt);
        continue;
      }
      const start = starts.get(event.id);
      if (!start) continue;
      totals.set(event.userId, (totals.get(event.userId) ?? 0) + Math.max(0, event.occurredAt.getTime() - start.getTime()));
      starts.delete(event.id);
    }
    for (const [membershipId, start] of starts) {
      const userId = events.find((item) => item.id === membershipId)?.userId;
      if (userId)
        totals.set(userId, (totals.get(userId) ?? 0) + Math.max(0, end.getTime() - start.getTime()));
    }
    return totals;
  }

  private rate(
    metricKey: MetricFact['metricKey'],
    numerator: number,
    denominator: number,
    dimensions: Record<string, string> = {},
  ): MetricFact {
    return {
      metricKey,
      dimensions,
      status: denominator === 0 ? 'UNAVAILABLE' : 'COMPLETE',
      value: ratio(numerator, denominator),
      numerator: BigInt(numerator),
      denominator: BigInt(denominator),
      sampleSize: denominator,
      ...(denominator === 0 ? { reasonCode: 'NO_ELIGIBLE_SAMPLE' } : {}),
    };
  }

  private value(
    metricKey: MetricFact['metricKey'],
    value: number | null,
    sampleSize: number,
  ): MetricFact {
    return {
      metricKey,
      dimensions: {},
      status: value === null ? 'UNAVAILABLE' : 'COMPLETE',
      value,
      numerator: value === null ? null : BigInt(Math.round(value)),
      denominator: null,
      sampleSize,
      ...(value === null ? { reasonCode: 'NO_ELIGIBLE_SAMPLE' } : {}),
    };
  }

  private unavailable(metricKey: MetricFact['metricKey'], reasonCode: string): MetricFact {
    return {
      metricKey,
      dimensions: {},
      status: 'PARTIAL',
      value: null,
      numerator: null,
      denominator: null,
      sampleSize: 0,
      reasonCode,
    };
  }
}
