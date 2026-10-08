import { roomLevelRange } from '../domain/policies/room-level-range.js';
import { loadLockedRealtimeRoom } from './locked-realtime-room.js';
import { roomLifecycle } from '../domain/policies/room-lifecycle.js';
import { RoomError } from '../domain/errors/room.error.js';
import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';

import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type {
  RoomDetail,
  RoomExtensionResult,
  RoomMembershipRecord,
  RoomRecord,
  RoomShareRecord,
} from '../domain/entities/room.js';
import { type RoomCefrLevel } from '../domain/entities/room.js';
import type {
  CreateRoomRepositoryInput,
  LockedRoom,
  RoomAssistanceContext,
  RoomRepository,
} from '../domain/ports/room.repository.js';
import { runRoomTransactionWithRetry } from './transaction-retry.js';
import { databaseNow, readEffectiveSafetyRestriction } from '../../safety/persistence.js';
import { RoomPolicy } from '../domain/policies/room.policy.js';
import { isSocialPairBlocked, readSocialUserEligible } from '../../social/index.js';

interface RoomProjection {
  id: string;
  kind: string;
  hostUserId: string;
  hostReconnectDeadline: Date | null;
  topic: string;
  cefrLevel: string;
  cefrLevelMin?: RoomCefrLevel | null;
  cefrLevelMax?: RoomCefrLevel | null;
  capacity: number;
  passwordDigest: string | null;
  status: string;
  startedAt: Date;
  endsAt: Date;
  visibility: string;
  shareCode: string;
  extensionCount: number;
  stateVersion: number;
  sensitiveSpeechDetectionEnabled: boolean;
  postRoomKeywordsEnabled: boolean;
  host: { profile: { displayName: string } | null };
  _count: { memberships: number };
  memberships?: MembershipProjection[];
}

interface MembershipProjection {
  id: string;
  roomId: string;
  userId: string;
  role: string;
  lifecycle: RoomMembershipRecord['lifecycle'];
  credentialVersion: number;
  joinOrder: number;
  rulesVersion: string;
  rulesAcceptedAt: Date;
  joinedAt: Date;
}

const roomInclude = {
  host: { select: { profile: { select: { displayName: true } } } },
  _count: { select: { memberships: { where: { lifecycle: 'ACTIVE' } } } },
} satisfies Prisma.RoomInclude;

@Injectable()
export class PrismaRoomRepository implements RoomRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: RoomPolicy,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  processingConsentAccepted(
    userId: string,
    purpose: 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS',
    noticeVersion: string,
  ): Promise<boolean> {
    return this.processingConsentAcceptedWith(this.prisma, userId, purpose, noticeVersion);
  }

  async createWithHost(input: CreateRoomRepositoryInput): Promise<RoomDetail> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await databaseNow(transaction);
      const account = await transaction.user.findUnique({
        where: { id: input.hostUserId },
        select: { status: true },
      });
      if (account?.status !== 'ACTIVE')
        throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is restricted');
      const restriction = await readEffectiveSafetyRestriction(
        transaction,
        input.hostUserId,
        current,
      );
      if (restriction)
        throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is temporarily restricted', {
          severity: restriction.severity,
          endsAt: restriction.endsAt.toISOString(),
        });
      const saved = await transaction.room.create({
        data: {
          id: input.id,
          hostUserId: input.hostUserId,
          topic: input.topic,
          cefrLevel: input.cefrLevel,
          ...roomLevelRange(input),
          capacity: input.capacity,
          passwordDigest: input.passwordDigest,
          status: 'OPEN',
          startedAt: input.startedAt,
          endsAt: input.endsAt,
          visibility: input.visibility,
          shareCode: input.shareCode,
          sensitiveSpeechDetectionEnabled: input.sensitiveSpeechDetectionEnabled,
          postRoomKeywordsEnabled: input.postRoomKeywordsEnabled,
          ...(input.postRoomKeywordsEnabled
            ? {
                keywordSummary: {
                  create: {
                    topicSnapshot: input.topic,
                    extractorVersion: input.keywordExtractorVersion,
                  },
                },
              }
            : {}),
          createdAt: input.startedAt,
          updatedAt: input.startedAt,
          memberships: {
            create: {
              id: input.hostMembershipId,
              userId: input.hostUserId,
              role: 'HOST',
              joinOrder: 1,
              rulesVersion: input.rulesVersion,
              rulesAcceptedAt: input.startedAt,
              joinedAt: input.startedAt,
              createdAt: input.startedAt,
            },
          },
        },
        include: { ...roomInclude, memberships: { where: { userId: input.hostUserId } } },
      });
      return this.toDetail(saved as RoomProjection);
    });
  }

  async listOpen(input: Parameters<RoomRepository['listOpen']>[0]) {
    const cursorWhere =
      input.cursor === null
        ? {}
        : {
            OR: [
              { startedAt: { lt: input.cursor.startedAt } },
              { startedAt: input.cursor.startedAt, id: { lt: input.cursor.id } },
            ],
          };
    const rows = await this.prisma.room.findMany({
      where: {
        kind: 'INSTANT',
        visibility: 'PUBLIC',
        status: 'OPEN',
        endsAt: { gt: input.now },
        ...(input.filter.cefrLevel === null ? {} : { cefrLevel: input.filter.cefrLevel }),
        ...(input.filter.topic === null
          ? {}
          : { topic: { contains: input.filter.topic, mode: 'insensitive' as const } }),
        ...cursorWhere,
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      include: roomInclude,
    });
    const hasMore = rows.length > input.limit;
    const pageRows = rows.slice(0, input.limit);
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((room) => this.toRoom(room as RoomProjection)),
      nextCursor: hasMore && last !== undefined ? { startedAt: last.startedAt, id: last.id } : null,
    };
  }

  async findDetail(roomId: string, userId: string): Promise<RoomDetail | null> {
    await this.withLockedRoom(roomId, userId, async () => undefined);
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { ...roomInclude, memberships: { where: { userId }, take: 1 } },
    });
    return room === null ? null : this.toDetail(room as RoomProjection);
  }

  async readAssistanceContext(input: {
    roomId: string;
    userId: string;
    now: Date;
  }): Promise<RoomAssistanceContext | null> {
    return this.prisma.$transaction(async (transaction) => {
      const room = await transaction.room.findUnique({
        where: { id: input.roomId },
        select: {
          id: true,
          topic: true,
          cefrLevel: true,
          status: true,
          endsAt: true,
          memberships: {
            where: { userId: input.userId },
            select: { lifecycle: true },
            take: 1,
          },
        },
      });
      if (!room) return null;
      const user = await transaction.user.findUnique({
        where: { id: input.userId },
        include: { profile: true },
      });
      let adult = false;
      if (user?.profile?.completedAt) {
        const month = input.now.getUTCMonth() + 1;
        const age =
          input.now.getUTCFullYear() -
          user.profile.birthYear -
          (month < user.profile.birthMonth ? 1 : 0);
        adult = age >= 18;
      }
      return {
        roomId: room.id,
        topic: room.topic,
        cefrLevel: room.cefrLevel,
        status: room.status,
        endsAt: room.endsAt,
        membershipActive: room.memberships[0]?.lifecycle === 'ACTIVE',
        userEligible:
          user?.status === 'ACTIVE' &&
          adult &&
          (await readEffectiveSafetyRestriction(transaction, input.userId, input.now)) === null,
      };
    });
  }

  async findByShareCode(
    shareCode: string,
    attributionId?: string,
  ): Promise<{ status: 'FOUND'; room: RoomShareRecord } | { status: 'UNAVAILABLE' } | null> {
    const initial = await this.prisma.room.findUnique({
      where: { shareCode },
      select: { id: true },
    });
    if (initial === null) return null;
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Room" WHERE "id"=${initial.id}::uuid FOR UPDATE`,
      );
      const context = await loadLockedRealtimeRoom(
        transaction,
        initial.id,
        this.config.get('POST_ROOM_KEYWORDS_JOB_DEADLINE_SECONDS', { infer: true }),
      );
      await roomLifecycle.settleAppointment(context);
      const room = await transaction.room.findUniqueOrThrow({
        where: { id: initial.id },
        include: {
          host: { select: { profile: { select: { displayName: true } } } },
          memberships: { where: { lifecycle: 'ACTIVE' }, select: { userId: true } },
          reservations: { where: { status: 'BOOKED' }, select: { userId: true } },
        },
      });
      if (
        !['SCHEDULED', 'OPEN'].includes(room.status) ||
        room.endsAt <= context.now ||
        room.host.profile === null
      )
        return { status: 'UNAVAILABLE' as const };

      const active = new Set(room.memberships.map(({ userId }) => userId));
      const reservedCount = room.reservations.filter(({ userId }) => !active.has(userId)).length;
      const existingAttribution = attributionId
        ? await transaction.roomShareAttribution.findFirst({
            where: { id: attributionId, roomId: room.id },
          })
        : null;
      const attribution =
        existingAttribution ??
        (await transaction.roomShareAttribution.create({
          data: { id: randomUUID(), roomId: room.id, openedAt: context.now },
        }));
      return {
        status: 'FOUND' as const,
        room: {
          attributionId: attribution.id,
          id: room.id,
          kind: room.kind,
          status: room.status,
          visibility: room.visibility,
          topic: room.topic,
          cefrLevel: roomLevelRange(room).cefrLevelMin,
          ...roomLevelRange(room),
          capacity: room.capacity,
          memberCount: active.size,
          reservedCount,
          availableCount: room.capacity - active.size - reservedCount,
          startedAt: room.startedAt,
          endsAt: room.endsAt,
          hostDisplayName: room.host.profile.displayName,
          passwordProtected: room.passwordDigest !== null,
          sensitiveSpeechDetectionEnabled: room.sensitiveSpeechDetectionEnabled,
          postRoomKeywordsEnabled: room.postRoomKeywordsEnabled,
        },
      };
    });
  }

  async extend(input: {
    roomId: string;
    actorUserId: string;
    clientRequestId: string;
    additionalMinutes: number;
  }): Promise<RoomExtensionResult> {
    const result = await runRoomTransactionWithRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.actorUserId}:${input.clientRequestId}`}, 0))`,
        );
        const previous = await transaction.roomTimeExtension.findUnique({
          where: {
            actorUserId_clientRequestId: {
              actorUserId: input.actorUserId,
              clientRequestId: input.clientRequestId,
            },
          },
        });
        if (previous) {
          if (
            previous.roomId !== input.roomId ||
            previous.additionalMinutes !== input.additionalMinutes
          )
            return new RoomError(
              'ROOM_EXTENSION_REQUEST_CONFLICT',
              'Extension request identifier was already used',
            );
          return this.extensionResult(previous);
        }
        const rows = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Room" WHERE "id"=${input.roomId}::uuid FOR UPDATE`,
        );
        if (!rows.length) return new RoomError('ROOM_NOT_FOUND', 'Room not found');
        const context = await loadLockedRealtimeRoom(
          transaction,
          input.roomId,
          this.config.get('POST_ROOM_KEYWORDS_JOB_DEADLINE_SECONDS', { infer: true }),
        );
        await roomLifecycle.settleAppointment(context);
        const actor = await transaction.user.findUnique({
          where: { id: input.actorUserId },
          select: { status: true },
        });
        if (actor?.status !== 'ACTIVE' || (await context.safetyRestriction(input.actorUserId)))
          return new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is restricted');
        try {
          this.policy.assertCanExtend({
            hostUserId: context.room.hostUserId,
            actorUserId: input.actorUserId,
            status: context.room.status,
            endsAt: context.room.endsAt,
            now: context.now,
            extensionCount: context.room.extensionCount,
            additionalMinutes: input.additionalMinutes,
          });
        } catch (error) {
          if (error instanceof RoomError) return error;
          throw error;
        }
        const previousEndsAt = context.room.endsAt;
        const endsAt = new Date(previousEndsAt.getTime() + input.additionalMinutes * 60_000);
        const extensionCount = context.room.extensionCount + 1;
        const stateVersion = context.room.stateVersion + 1;
        await context.saveRoom({ endsAt, extensionCount, stateVersion });
        const extension = await transaction.roomTimeExtension.create({
          data: {
            roomId: input.roomId,
            actorUserId: input.actorUserId,
            clientRequestId: input.clientRequestId,
            additionalMinutes: input.additionalMinutes,
            previousEndsAt,
            endsAt,
            resultingCount: extensionCount,
            resultingStateVersion: stateVersion,
            createdAt: context.now,
          },
        });
        await context.appendEvent({
          type: 'room_time_extended',
          source: 'http',
          actorId: input.actorUserId,
          reason: `MINUTES_${input.additionalMinutes}`,
          result: 'COMMITTED',
          occurredAt: context.now,
        });
        await context.enqueue('SYNC_ROOM_TIME');
        return this.extensionResult(extension);
      }),
    );
    if (result instanceof RoomError) throw result;
    return result;
  }

  async withLockedRoom<T>(
    roomId: string,
    userId: string,
    operation: (locked: LockedRoom) => Promise<T>,
  ): Promise<T | null> {
    const result = await runRoomTransactionWithRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Room" WHERE "id" = ${roomId}::uuid FOR UPDATE`,
        );
        if (lockedRows.length === 0) return null;

        const context = await loadLockedRealtimeRoom(
          transaction,
          roomId,
          this.config.get('POST_ROOM_KEYWORDS_JOB_DEADLINE_SECONDS', { infer: true }),
        );
        await roomLifecycle.settleAppointment(context);
        const room = await transaction.room.findUniqueOrThrow({
          where: { id: roomId },
          include: { ...roomInclude, memberships: { where: { userId }, take: 1 } },
        });
        const maximum = await transaction.roomMembership.aggregate({
          where: { roomId },
          _max: { joinOrder: true },
        });
        const projection = room as RoomProjection;
        const account = await transaction.user.findUnique({
          where: { id: userId },
          select: { status: true },
        });
        const safetyRestriction = await readEffectiveSafetyRestriction(
          transaction,
          userId,
          context.now,
        );
        const locked: LockedRoom = {
          now: context.now,
          reservedUserIds: context.reservedUserIds ?? [],
          accountActive: account?.status === 'ACTIVE',
          safetyRestriction,
          room: this.toRoom(projection),
          existingMembership: this.toOptionalMembership(projection.memberships?.[0]),
          nextJoinOrder: (maximum._max.joinOrder ?? 0) + 1,
          roomSpeechConsentAccepted: await this.roomSpeechConsentAccepted(transaction, userId),
          postRoomKeywordsConsentAccepted: await this.processingConsentAcceptedWith(
            transaction,
            userId,
            'POST_ROOM_KEYWORDS',
            this.config.get('POST_ROOM_KEYWORDS_NOTICE_VERSION', { infer: true }),
          ),
          consumeInvitation: async (invitationId, consumedAt) => {
            const invitation = await transaction.roomInvitation.findUnique({
              where: { id: invitationId },
            });
            if (
              invitation?.roomId === roomId &&
              invitation.inviteeUserId === userId &&
              invitation.status === 'CONSUMED' &&
              projection.memberships?.[0]?.lifecycle === 'ACTIVE'
            )
              return;
            if (
              !invitation ||
              invitation.roomId !== roomId ||
              invitation.inviteeUserId !== userId ||
              invitation.status !== 'PENDING' ||
              (await isSocialPairBlocked(
                transaction,
                invitation.inviterUserId,
                invitation.inviteeUserId,
              )) ||
              !(await readSocialUserEligible(transaction, userId, consumedAt))
            )
              throw new RoomError('ROOM_INVITATION_NOT_FOUND', 'Room invitation was not found');
            await transaction.roomInvitation.update({
              where: { id: invitation.id },
              data: { status: 'CONSUMED', resolvedAt: consumedAt, updatedAt: consumedAt },
            });
          },
          markShareAttribution: async (attributionId, joinedAt) => {
            await transaction.roomShareAttribution.updateMany({
              where: { id: attributionId, roomId, joinedAt: null },
              data: { joinedAt },
            });
          },
          createMembership: async (input) => {
            const membership = await transaction.roomMembership.upsert({
              where: { roomId_userId: { roomId, userId: input.userId } },
              update: {
                lifecycle: 'ACTIVE',
                role: room.hostUserId === input.userId ? 'HOST' : 'MEMBER',
                joinOrder: (maximum._max.joinOrder ?? 0) + 1,
                participantIdentity: randomUUID(),
                credentialVersion: { increment: 1 },
                presence: 'DISCONNECTED',
                providerSessionSid: null,
                presenceUpdatedAt: null,
                leftAt: null,
                removedAt: null,
                removalReason: null,
                rulesVersion: input.rulesVersion,
                rulesAcceptedAt: input.now,
                joinedAt: input.now,
              },
              create: {
                id: input.id || randomUUID(),
                roomId,
                userId: input.userId,
                role: room.hostUserId === input.userId ? 'HOST' : 'MEMBER',
                joinOrder: (maximum._max.joinOrder ?? 0) + 1,
                rulesVersion: input.rulesVersion,
                rulesAcceptedAt: input.now,
                joinedAt: input.now,
                createdAt: input.now,
              },
            });
            await transaction.roomReservation.updateMany({
              where: { roomId, userId: input.userId, status: 'BOOKED' },
              data: { status: 'CONSUMED', version: { increment: 1 }, consumedAt: input.now },
            });
            return this.toMembership(membership);
          },
        };
        try {
          return await operation(locked);
        } catch (error) {
          if (error instanceof RoomError) return error;
          throw error;
        }
      }),
    );
    if (result instanceof RoomError) throw result;
    return result;
  }

  private toDetail(room: RoomProjection): RoomDetail {
    return {
      room: this.toRoom(room),
      currentMembership: this.toOptionalMembership(room.memberships?.[0]),
    };
  }

  private toRoom(room: RoomProjection): RoomRecord {
    const hostDisplayName = room.host.profile?.displayName;
    if (hostDisplayName === undefined) {
      throw new Error(`Eligible room host ${room.hostUserId} has no profile`);
    }
    return {
      id: room.id,
      kind: room.kind as RoomRecord['kind'],
      hostUserId: room.hostUserId,
      hostDisplayName,
      topic: room.topic,
      cefrLevel: room.cefrLevel as RoomRecord['cefrLevel'],
      ...roomLevelRange(room),
      capacity: room.capacity,
      passwordDigest: room.passwordDigest,
      status: room.status as RoomRecord['status'],
      startedAt: room.startedAt,
      endsAt: room.endsAt,
      memberCount: room._count.memberships,
      hostReconnectDeadline: room.hostReconnectDeadline,
      visibility: room.visibility as RoomRecord['visibility'],
      shareCode: room.shareCode,
      extensionCount: room.extensionCount,
      stateVersion: room.stateVersion,
      sensitiveSpeechDetectionEnabled: room.sensitiveSpeechDetectionEnabled,
      postRoomKeywordsEnabled: room.postRoomKeywordsEnabled,
    };
  }

  private async roomSpeechConsentAccepted(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
    noticeVersion = this.config.get('ROOM_SPEECH_NOTICE_VERSION', { infer: true }),
  ): Promise<boolean> {
    return this.processingConsentAcceptedWith(
      client,
      userId,
      'ROOM_SAFETY_DETECTION',
      noticeVersion,
    );
  }

  private async processingConsentAcceptedWith(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
    purpose: 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS',
    noticeVersion: string,
  ): Promise<boolean> {
    const event = await client.speechProcessingConsentEvent.findFirst({
      where: { userId, purpose },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return event?.action === 'ACCEPT' && event.noticeVersion === noticeVersion;
  }

  private extensionResult(extension: {
    roomId: string;
    previousEndsAt: Date;
    endsAt: Date;
    resultingCount: number;
    resultingStateVersion: number;
  }): RoomExtensionResult {
    return {
      roomId: extension.roomId,
      previousEndsAt: extension.previousEndsAt,
      endsAt: extension.endsAt,
      extensionCount: extension.resultingCount,
      remainingExtensions: 3 - extension.resultingCount,
      stateVersion: extension.resultingStateVersion,
    };
  }

  private toOptionalMembership(
    membership: MembershipProjection | undefined,
  ): RoomMembershipRecord | null {
    return membership === undefined ? null : this.toMembership(membership);
  }

  private toMembership(membership: MembershipProjection): RoomMembershipRecord {
    return {
      id: membership.id,
      roomId: membership.roomId,
      userId: membership.userId,
      role: membership.role as RoomMembershipRecord['role'],
      joinOrder: membership.joinOrder,
      lifecycle: membership.lifecycle,
      credentialVersion: membership.credentialVersion,
      rulesVersion: membership.rulesVersion,
      rulesAcceptedAt: membership.rulesAcceptedAt,
      joinedAt: membership.joinedAt,
    };
  }
}
