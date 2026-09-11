import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { RoomDetail, RoomMembershipRecord, RoomRecord } from '../domain/entities/room.js';
import type {
  CreateRoomRepositoryInput,
  LockedRoom,
  RoomRepository,
} from '../domain/ports/room.repository.js';
import { runRoomTransactionWithRetry } from './transaction-retry.js';

interface RoomProjection {
  id: string;
  hostUserId: string;
  topic: string;
  cefrLevel: string;
  capacity: number;
  passwordDigest: string | null;
  status: string;
  startedAt: Date;
  endsAt: Date;
  host: { profile: { displayName: string } | null };
  _count: { memberships: number };
  memberships?: MembershipProjection[];
}

interface MembershipProjection {
  id: string;
  roomId: string;
  userId: string;
  role: string;
  joinOrder: number;
  rulesVersion: string;
  rulesAcceptedAt: Date;
  joinedAt: Date;
}

const roomInclude = {
  host: { select: { profile: { select: { displayName: true } } } },
  _count: { select: { memberships: true } },
} satisfies Prisma.RoomInclude;

@Injectable()
export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithHost(input: CreateRoomRepositoryInput): Promise<RoomDetail> {
    return this.prisma.$transaction(async (transaction) => {
      const saved = await transaction.room.create({
        data: {
          id: input.id,
          hostUserId: input.hostUserId,
          topic: input.topic,
          cefrLevel: input.cefrLevel,
          capacity: input.capacity,
          passwordDigest: input.passwordDigest,
          status: 'OPEN',
          startedAt: input.startedAt,
          endsAt: input.endsAt,
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
      where: { status: 'OPEN', endsAt: { gt: input.now }, ...cursorWhere },
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
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { ...roomInclude, memberships: { where: { userId }, take: 1 } },
    });
    return room === null ? null : this.toDetail(room as RoomProjection);
  }

  async withLockedRoom<T>(
    roomId: string,
    userId: string,
    operation: (locked: LockedRoom) => Promise<T>,
  ): Promise<T | null> {
    return runRoomTransactionWithRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Room" WHERE "id" = ${roomId}::uuid FOR UPDATE`,
        );
        if (lockedRows.length === 0) return null;

        const room = await transaction.room.findUniqueOrThrow({
          where: { id: roomId },
          include: { ...roomInclude, memberships: { where: { userId }, take: 1 } },
        });
        const maximum = await transaction.roomMembership.aggregate({
          where: { roomId },
          _max: { joinOrder: true },
        });
        const projection = room as RoomProjection;
        const locked: LockedRoom = {
          room: this.toRoom(projection),
          existingMembership: this.toOptionalMembership(projection.memberships?.[0]),
          nextJoinOrder: (maximum._max.joinOrder ?? 0) + 1,
          createMembership: async (input) => {
            const membership = await transaction.roomMembership.create({
              data: {
                id: input.id || randomUUID(),
                roomId,
                userId: input.userId,
                role: 'MEMBER',
                joinOrder: (maximum._max.joinOrder ?? 0) + 1,
                rulesVersion: input.rulesVersion,
                rulesAcceptedAt: input.now,
                joinedAt: input.now,
                createdAt: input.now,
              },
            });
            return this.toMembership(membership);
          },
        };
        return operation(locked);
      }),
    );
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
      hostUserId: room.hostUserId,
      hostDisplayName,
      topic: room.topic,
      cefrLevel: room.cefrLevel as RoomRecord['cefrLevel'],
      capacity: room.capacity,
      passwordDigest: room.passwordDigest,
      status: room.status as RoomRecord['status'],
      startedAt: room.startedAt,
      endsAt: room.endsAt,
      memberCount: room._count.memberships,
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
      rulesVersion: membership.rulesVersion,
      rulesAcceptedAt: membership.rulesAcceptedAt,
      joinedAt: membership.joinedAt,
    };
  }
}
