import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  isSocialPairBlocked,
  lockSocialPair,
  readSocialUserEligible,
  runSocialCommand,
  SocialService,
} from '../../social/index.js';
import type { SocialCursor } from '../../social/domain/entities/social.js';
import type { RoomInvitationRecord } from '../domain/entities/room-invitation.js';
import { RoomError } from '../domain/errors/room.error.js';
import type { RoomInvitationRepository } from '../domain/ports/room-invitation.repository.js';

@Injectable()
export class PrismaRoomInvitationRepository implements RoomInvitationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly social: SocialService,
  ) {}

  async create(input: Parameters<RoomInvitationRepository['create']>[0]) {
    const initiallyInvitable = await this.social.canInvite(
      input.actorUserId,
      input.targetUserId,
      input.now,
    );
    const result = await this.prisma.$transaction(async (tx) =>
      runSocialCommand(
        tx,
        {
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          type: 'ROOM_INVITATION_CREATE',
          payload: { roomId: input.roomId, targetUserId: input.targetUserId },
        },
        async () => {
          await tx.$executeRaw(
            Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`room-invite:${input.roomId}:${input.targetUserId}`}, 0))`,
          );
          await lockSocialPair(tx, input.actorUserId, input.targetUserId);
          const room = await tx.room.findUnique({ where: { id: input.roomId } });
          if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
          if (room.hostUserId !== input.actorUserId)
            throw new RoomError('ROOM_HOST_REQUIRED', 'Current host permission is required');
          if (!['SCHEDULED', 'OPEN'].includes(room.status) || room.endsAt <= input.now)
            throw new RoomError('ROOM_ENDED', 'Room is not available');
          const membership = await tx.roomMembership.findUnique({
            where: { roomId_userId: { roomId: input.roomId, userId: input.targetUserId } },
          });
          if (membership?.lifecycle === 'ACTIVE' || membership?.lifecycle === 'REMOVED')
            throw new RoomError(
              membership.lifecycle === 'REMOVED'
                ? 'ROOM_INVITATION_REQUIRED'
                : 'ROOM_INVITATION_TARGET_UNAVAILABLE',
              'Invitation target is unavailable',
            );
          if (
            !initiallyInvitable ||
            !(await readSocialUserEligible(tx, input.targetUserId, input.now)) ||
            (await isSocialPairBlocked(tx, input.actorUserId, input.targetUserId))
          )
            throw new RoomError(
              'ROOM_INVITATION_TARGET_UNAVAILABLE',
              'Invitation target is unavailable',
            );
          const existing = await tx.roomInvitation.findFirst({
            where: { roomId: input.roomId, inviteeUserId: input.targetUserId, status: 'PENDING' },
          });
          if (existing) return { id: existing.id };
          const invitation = await tx.roomInvitation.create({
            data: {
              id: randomUUID(),
              roomId: input.roomId,
              inviterUserId: input.actorUserId,
              inviteeUserId: input.targetUserId,
              createdAt: input.now,
              updatedAt: input.now,
            },
          });
          return { id: invitation.id };
        },
      ),
    );
    return this.byId(result.id);
  }

  async list(input: Parameters<RoomInvitationRepository['list']>[0]) {
    const rows = await this.prisma.roomInvitation.findMany({
      where: {
        inviteeUserId: input.userId,
        status: 'PENDING',
        room: { status: { in: ['SCHEDULED', 'OPEN'] }, endsAt: { gt: input.now } },
        ...this.after(input.cursor),
      },
      include: {
        room: true,
        inviter: { include: { profile: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit * 2 + 1,
    });
    const visible = [];
    for (const row of rows.slice(0, input.limit * 2)) {
      if (await this.social.canInvite(row.inviterUserId, input.userId, input.now)) {
        visible.push({
          ...this.record(row),
          room: {
            topic: row.room.topic,
            cefrLevel: row.room.cefrLevel,
            status: row.room.status,
            startedAt: row.room.startedAt,
            endsAt: row.room.endsAt,
            passwordProtected: row.room.passwordDigest !== null,
          },
          inviterDisplayName: row.inviter.profile?.displayName ?? 'Unavailable user',
        });
      }
      if (visible.length === input.limit) break;
    }
    const last = rows.slice(0, input.limit * 2).at(-1);
    return {
      items: visible,
      nextCursor:
        rows.length > input.limit * 2 && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }

  async decline(input: Parameters<RoomInvitationRepository['decline']>[0]) {
    const result = await this.prisma.$transaction(async (tx) =>
      runSocialCommand(
        tx,
        {
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
          type: 'ROOM_INVITATION_DECLINE',
          payload: { invitationId: input.invitationId },
        },
        async () => {
          const invitation = await tx.roomInvitation.findUnique({
            where: { id: input.invitationId },
          });
          if (
            !invitation ||
            invitation.inviteeUserId !== input.actorUserId ||
            invitation.status !== 'PENDING'
          )
            throw new RoomError('ROOM_INVITATION_NOT_FOUND', 'Room invitation was not found');
          await lockSocialPair(tx, invitation.inviterUserId, invitation.inviteeUserId);
          await tx.roomInvitation.update({
            where: { id: invitation.id },
            data: { status: 'DECLINED', resolvedAt: input.now, updatedAt: input.now },
          });
          return { id: invitation.id };
        },
      ),
    );
    return this.byId(result.id);
  }

  private async byId(id: string): Promise<RoomInvitationRecord> {
    return this.record(await this.prisma.roomInvitation.findUniqueOrThrow({ where: { id } }));
  }

  private record(row: {
    id: string;
    roomId: string;
    inviterUserId: string;
    inviteeUserId: string;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
  }): RoomInvitationRecord {
    return { ...row, status: row.status as RoomInvitationRecord['status'] };
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
}
