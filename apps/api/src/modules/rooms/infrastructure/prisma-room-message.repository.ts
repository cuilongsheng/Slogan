import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type RoomTextMessage as SavedMessage } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { RoomError } from '../domain/errors/room.error.js';
import type {
  RoomMessageRepository,
  RoomTextMessage,
} from '../domain/ports/room-message.repository.js';
import { databaseNow } from '../../safety/persistence.js';
import { readSocialUserEligible } from '../../social/index.js';
import { runRoomTransactionWithRetry } from './transaction-retry.js';
@Injectable()
export class PrismaRoomMessageRepository implements RoomMessageRepository {
  constructor(private readonly prisma: PrismaService) {}
  private async active<T>(
    roomId: string,
    userId: string,
    operation: (tx: Prisma.TransactionClient, now: Date, displayName: string) => Promise<T>,
  ) {
    return runRoomTransactionWithRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Room" WHERE "id"=${roomId}::uuid FOR UPDATE`,
        );
        if (!rows.length) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
        const now = await databaseNow(tx);
        const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } });
        if (room.status !== 'OPEN' || room.endsAt <= now)
          throw new RoomError('ROOM_ENDED', 'Room ended');
        const member = await tx.roomMembership.findUnique({
          where: { roomId_userId: { roomId, userId } },
        });
        if (member?.lifecycle !== 'ACTIVE')
          throw new RoomError('ROOM_MEMBER_NOT_ACTIVE', 'Active membership required');
        if (!(await readSocialUserEligible(tx, userId, now)))
          throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account restricted');
        const profile = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
        if (!profile.completedAt)
          throw new RoomError('PROFILE_REQUIRED', 'Complete profile required');
        return operation(tx, now, profile.displayName);
      }),
    );
  }
  send(input: Parameters<RoomMessageRepository['send']>[0]) {
    return this.active(input.roomId, input.userId, async (tx, now, displayName) => {
      const previous = await tx.roomTextMessage.findUnique({
        where: {
          roomId_senderUserId_clientRequestId: {
            roomId: input.roomId,
            senderUserId: input.userId,
            clientRequestId: input.clientRequestId,
          },
        },
      });
      if (previous) {
        if (previous.text !== input.text)
          throw new RoomError('ROOM_OPERATION_CONFLICT', 'Message request identifier already used');
        return this.present(previous);
      }
      const recent = await tx.roomTextMessage.count({
        where: {
          roomId: input.roomId,
          senderUserId: input.userId,
          createdAt: { gt: new Date(now.getTime() - 5000) },
        },
      });
      if (recent >= 5) throw new RoomError('ROOM_MESSAGE_RATE_LIMITED', 'Too many messages');
      return this.present(
        await tx.roomTextMessage.create({
          data: {
            id: randomUUID(),
            roomId: input.roomId,
            senderUserId: input.userId,
            senderDisplayName: displayName,
            clientRequestId: input.clientRequestId,
            text: input.text,
            createdAt: now,
          },
        }),
      );
    });
  }
  list(input: Parameters<RoomMessageRepository['list']>[0]) {
    return this.active(input.roomId, input.userId, async (tx) => {
      const rows = await tx.roomTextMessage.findMany({
        where: {
          roomId: input.roomId,
          ...(input.after ? { sequence: { gt: BigInt(input.after) } } : {}),
        },
        orderBy: { sequence: input.after ? 'asc' : 'desc' },
        take: input.limit + 1,
      });
      const selected = rows.slice(0, input.limit);
      return {
        items: (input.after ? selected : selected.reverse()).map((row) => this.present(row)),
        hasMore: !!input.after && rows.length > input.limit,
      };
    });
  }
  private present(row: SavedMessage): RoomTextMessage {
    return {
      id: row.id,
      sequence: row.sequence.toString(),
      senderUserId: row.senderUserId,
      senderDisplayName: row.senderDisplayName,
      text: row.text,
      createdAt: row.createdAt,
    };
  }
}
