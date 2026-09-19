import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { readEffectiveSafetyRestriction } from '../../safety/persistence.js';
import type {
  FriendRequestRecord,
  PublicSocialProfile,
  SocialCursor,
} from '../domain/entities/social.js';
import { SocialError } from '../domain/errors/social.error.js';
import type { SocialRepository } from '../domain/ports/social.repository.js';
import { SocialPolicy } from '../domain/policies/social.policy.js';
import { isSocialPairBlocked, lockSocialPair, runSocialCommand } from '../persistence.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaSocialRepository implements SocialRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SocialPolicy,
  ) {}

  async createFriendRequest(input: Parameters<SocialRepository['createFriendRequest']>[0]) {
    const result = await this.prisma.$transaction(async (tx) =>
      runSocialCommand(
        tx,
        {
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          type: 'FRIEND_REQUEST_CREATE',
          payload: { targetUserId: input.targetUserId },
        },
        async () => {
          const [userLowId, userHighId] = await lockSocialPair(
            tx,
            input.actorUserId,
            input.targetUserId,
          );
          if (
            !(await this.userEligible(tx, input.actorUserId, input.now)) ||
            !(await this.userEligible(tx, input.targetUserId, input.now)) ||
            (await isSocialPairBlocked(tx, input.actorUserId, input.targetUserId))
          )
            throw new SocialError('SOCIAL_TARGET_UNAVAILABLE', 'Social target is unavailable');
          const friendship = await tx.friendship.findUnique({
            where: { userLowId_userHighId: { userLowId, userHighId } },
          });
          if (friendship?.endedAt === null)
            throw new SocialError('SOCIAL_REQUEST_STATE_CONFLICT', 'Users are already friends');
          const pending = await tx.friendRequest.findFirst({
            where: { userLowId, userHighId, status: 'PENDING' },
          });
          if (pending) return { id: pending.id };
          const created = await tx.friendRequest.create({
            data: {
              id: randomUUID(),
              requesterUserId: input.actorUserId,
              recipientUserId: input.targetUserId,
              userLowId,
              userHighId,
              createdAt: input.now,
              updatedAt: input.now,
            },
          });
          return { id: created.id };
        },
      ),
    );
    return this.friendRequestById(result.id);
  }

  async resolveFriendRequest(input: Parameters<SocialRepository['resolveFriendRequest']>[0]) {
    const result = await this.prisma.$transaction(async (tx) =>
      runSocialCommand(
        tx,
        {
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          type: (
            {
              accept: 'FRIEND_REQUEST_ACCEPT',
              reject: 'FRIEND_REQUEST_REJECT',
              withdraw: 'FRIEND_REQUEST_WITHDRAW',
            } as const
          )[input.action],
          payload: { requestId: input.requestId, action: input.action },
        },
        async () => {
          const request = await tx.friendRequest.findUnique({ where: { id: input.requestId } });
          if (!request)
            throw new SocialError('SOCIAL_REQUEST_NOT_FOUND', 'Friend request was not found');
          await lockSocialPair(tx, request.userLowId, request.userHighId);
          this.policy.assertRequestActor(input.action, input.actorUserId, request);
          if (input.action === 'accept') {
            if (
              !(await this.userEligible(tx, request.requesterUserId, input.now)) ||
              !(await this.userEligible(tx, request.recipientUserId, input.now)) ||
              (await isSocialPairBlocked(tx, request.requesterUserId, request.recipientUserId))
            )
              throw new SocialError('SOCIAL_TARGET_UNAVAILABLE', 'Social target is unavailable');
            await tx.friendship.upsert({
              where: {
                userLowId_userHighId: {
                  userLowId: request.userLowId,
                  userHighId: request.userHighId,
                },
              },
              create: {
                id: randomUUID(),
                userLowId: request.userLowId,
                userHighId: request.userHighId,
                createdAt: input.now,
                updatedAt: input.now,
              },
              update: {
                endedAt: null,
                endedByUserId: null,
                createdAt: input.now,
                updatedAt: input.now,
              },
            });
          }
          await tx.friendRequest.update({
            where: { id: request.id },
            data: {
              status: (
                {
                  accept: 'ACCEPTED',
                  reject: 'REJECTED',
                  withdraw: 'WITHDRAWN',
                } as const
              )[input.action],
              resolvedAt: input.now,
              updatedAt: input.now,
            },
          });
          return { id: request.id };
        },
      ),
    );
    return this.friendRequestById(result.id);
  }

  async listFriendRequests(input: Parameters<SocialRepository['listFriendRequests']>[0]) {
    const owner =
      input.direction === 'incoming'
        ? { recipientUserId: input.userId }
        : { requesterUserId: input.userId };
    const rows = await this.prisma.friendRequest.findMany({
      where: { ...owner, status: 'PENDING', ...this.after(input.cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });
    return this.page(
      rows.map((row) => this.request(row)),
      input.limit,
    );
  }

  async listFriends(input: Parameters<SocialRepository['listFriends']>[0]) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        endedAt: null,
        OR: [{ userLowId: input.userId }, { userHighId: input.userId }],
        ...this.after(input.cursor),
      },
      include: {
        userLow: { include: { profile: true } },
        userHigh: { include: { profile: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });
    const mapped = rows.flatMap((row) => {
      const other = row.userLowId === input.userId ? row.userHigh : row.userLow;
      if (other.status !== 'ACTIVE' || !other.profile) return [];
      return [{ id: row.id, friend: this.profile(other), createdAt: row.createdAt }];
    });
    return this.page(mapped, input.limit);
  }

  async deleteFriend(input: Parameters<SocialRepository['deleteFriend']>[0]) {
    const result = await this.prisma.$transaction(async (tx) =>
      runSocialCommand(
        tx,
        {
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          type: 'FRIEND_DELETE',
          payload: { friendUserId: input.friendUserId },
        },
        async () => {
          const [userLowId, userHighId] = await lockSocialPair(
            tx,
            input.actorUserId,
            input.friendUserId,
          );
          const friendship = await tx.friendship.findUnique({
            where: { userLowId_userHighId: { userLowId, userHighId } },
          });
          if (!friendship || friendship.endedAt)
            throw new SocialError('SOCIAL_RELATIONSHIP_NOT_FOUND', 'Friendship was not found');
          await tx.friendship.update({
            where: { id: friendship.id },
            data: { endedAt: input.now, endedByUserId: input.actorUserId, updatedAt: input.now },
          });
          return { friendshipId: friendship.id, endedAt: input.now.toISOString() };
        },
      ),
    );
    return { friendshipId: result.friendshipId, endedAt: new Date(result.endedAt) };
  }

  async createBlock(input: Parameters<SocialRepository['createBlock']>[0]) {
    const result = await this.prisma.$transaction(async (tx) =>
      runSocialCommand(
        tx,
        {
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          type: 'BLOCK_CREATE',
          payload: { targetUserId: input.targetUserId },
        },
        async () => {
          const [userLowId, userHighId] = await lockSocialPair(
            tx,
            input.actorUserId,
            input.targetUserId,
          );
          if (
            !(await tx.user.findUnique({ where: { id: input.targetUserId }, select: { id: true } }))
          )
            throw new SocialError('SOCIAL_TARGET_UNAVAILABLE', 'Social target is unavailable');
          const block = await tx.userBlock.upsert({
            where: {
              blockerUserId_blockedUserId: {
                blockerUserId: input.actorUserId,
                blockedUserId: input.targetUserId,
              },
            },
            create: {
              id: randomUUID(),
              blockerUserId: input.actorUserId,
              blockedUserId: input.targetUserId,
              createdAt: input.now,
              updatedAt: input.now,
            },
            update: { unblockedAt: null, createdAt: input.now, updatedAt: input.now },
          });
          await tx.friendship.updateMany({
            where: { userLowId, userHighId, endedAt: null },
            data: { endedAt: input.now, endedByUserId: input.actorUserId, updatedAt: input.now },
          });
          await tx.friendRequest.updateMany({
            where: { userLowId, userHighId, status: 'PENDING' },
            data: { status: 'BLOCKED', resolvedAt: input.now, updatedAt: input.now },
          });
          await tx.roomInvitation.updateMany({
            where: {
              status: 'PENDING',
              OR: [
                { inviterUserId: input.actorUserId, inviteeUserId: input.targetUserId },
                { inviterUserId: input.targetUserId, inviteeUserId: input.actorUserId },
              ],
            },
            data: { status: 'CANCELLED', resolvedAt: input.now, updatedAt: input.now },
          });
          return { id: block.id };
        },
      ),
    );
    const block = await this.prisma.userBlock.findUniqueOrThrow({ where: { id: result.id } });
    return { id: block.id, blockedUserId: block.blockedUserId, createdAt: block.createdAt };
  }

  async deleteBlock(input: Parameters<SocialRepository['deleteBlock']>[0]) {
    const result = await this.prisma.$transaction(async (tx) =>
      runSocialCommand(
        tx,
        {
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          type: 'BLOCK_DELETE',
          payload: { targetUserId: input.targetUserId },
        },
        async () => {
          await lockSocialPair(tx, input.actorUserId, input.targetUserId);
          const block = await tx.userBlock.findUnique({
            where: {
              blockerUserId_blockedUserId: {
                blockerUserId: input.actorUserId,
                blockedUserId: input.targetUserId,
              },
            },
          });
          if (!block || block.unblockedAt)
            throw new SocialError('SOCIAL_RELATIONSHIP_NOT_FOUND', 'User block was not found');
          await tx.userBlock.update({
            where: { id: block.id },
            data: { unblockedAt: input.now, updatedAt: input.now },
          });
          return { blockId: block.id, unblockedAt: input.now.toISOString() };
        },
      ),
    );
    return { blockId: result.blockId, unblockedAt: new Date(result.unblockedAt) };
  }

  async listBlocks(input: Parameters<SocialRepository['listBlocks']>[0]) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerUserId: input.userId, unblockedAt: null, ...this.after(input.cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });
    return this.page(
      rows.map((row) => ({
        id: row.id,
        blockedUserId: row.blockedUserId,
        createdAt: row.createdAt,
      })),
      input.limit,
    );
  }

  async listAvailableCandidates(input: Parameters<SocialRepository['listAvailableCandidates']>[0]) {
    const rows = await this.prisma.user.findMany({
      where: {
        id: { not: input.userId },
        status: 'ACTIVE',
        profile: { isNot: null },
        roomMemberships: { none: { lifecycle: 'ACTIVE' } },
        safetyRestrictions: {
          none: {
            kind: 'TEMPORARY',
            status: 'ACTIVE',
            liftedAt: null,
            startsAt: { lte: input.now },
            endsAt: { gt: input.now },
          },
        },
        blocksCreated: {
          none: { blockedUserId: input.userId, unblockedAt: null },
        },
        blocksReceived: {
          none: { blockerUserId: input.userId, unblockedAt: null },
        },
        ...this.after(input.cursor),
      },
      include: { profile: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit * 5 + 1,
    });
    const scanned = rows.slice(0, input.limit * 5);
    const allowed = scanned
      .filter((row) => row.profile && this.adult(row.profile, input.now))
      .map((row) => ({
        ...this.profile(row),
        createdAt: row.createdAt,
      }));
    const last = scanned.at(-1);
    return {
      items: allowed,
      nextCursor:
        rows.length > input.limit * 5 && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }

  async assertActorEligible(userId: string, now: Date): Promise<void> {
    if (!(await this.isTargetEligible(userId, now)))
      throw new SocialError('SOCIAL_ACCESS_RESTRICTED', 'Social access is restricted');
  }

  async isFriend(leftUserId: string, rightUserId: string): Promise<boolean> {
    const [userLowId, userHighId] = this.policy.pair(leftUserId, rightUserId);
    const row = await this.prisma.friendship.findUnique({
      where: { userLowId_userHighId: { userLowId, userHighId } },
    });
    return row?.endedAt === null;
  }

  async isPairBlocked(leftUserId: string, rightUserId: string): Promise<boolean> {
    return isSocialPairBlocked(this.prisma, leftUserId, rightUserId);
  }

  async isTargetEligible(userId: string, now: Date): Promise<boolean> {
    return this.userEligible(this.prisma, userId, now);
  }

  async isTargetOutsideRooms(userId: string): Promise<boolean> {
    return (
      (await this.prisma.roomMembership.count({ where: { userId, lifecycle: 'ACTIVE' } })) === 0
    );
  }

  private async userEligible(tx: Tx, userId: string, now: Date): Promise<boolean> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    return (
      user?.status === 'ACTIVE' &&
      !!user.profile &&
      this.adult(user.profile, now) &&
      (await readEffectiveSafetyRestriction(tx, userId, now)) === null
    );
  }

  private adult(profile: { birthYear: number; birthMonth: number }, now: Date): boolean {
    const month = now.getUTCMonth() + 1;
    return now.getUTCFullYear() - profile.birthYear - (month < profile.birthMonth ? 1 : 0) >= 18;
  }

  private profile(user: {
    id: string;
    profile: {
      displayName: string;
      avatarUrl: string;
      cefrLevel: string;
      nationalityCode: string | null;
      city: string | null;
      interestCodes: string[];
    } | null;
  }): PublicSocialProfile {
    if (!user.profile) throw new Error(`Eligible user ${user.id} has no profile`);
    return {
      userId: user.id,
      displayName: user.profile.displayName,
      avatarUrl: user.profile.avatarUrl,
      cefrLevel: user.profile.cefrLevel,
      nationalityCode: user.profile.nationalityCode,
      city: user.profile.city,
      interestCodes: user.profile.interestCodes,
    };
  }

  private request(row: {
    id: string;
    requesterUserId: string;
    recipientUserId: string;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
  }): FriendRequestRecord {
    return { ...row, status: row.status as FriendRequestRecord['status'] };
  }

  private friendRequestById(id: string): Promise<FriendRequestRecord> {
    return this.prisma.friendRequest
      .findUniqueOrThrow({ where: { id } })
      .then((row) => this.request(row));
  }

  private after(cursor: SocialCursor | null) {
    return cursor === null
      ? {}
      : {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        };
  }

  private page<T extends { id: string; createdAt: Date }>(rows: T[], limit: number) {
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }
}
