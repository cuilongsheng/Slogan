import { roomLifecycle } from '../domain/policies/room-lifecycle.js';
import { RoomError } from '../domain/errors/room.error.js';
import { loadLockedRealtimeRoom } from './locked-realtime-room.js';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type {
  LockedRealtimeRoom,
  RoomRealtimeRepository,
  RealtimeCommand,
  RealtimeEvent,
  ReconciliationHead,
} from '../domain/ports/room-realtime.repository.js';
import { runRoomTransactionWithRetry } from './transaction-retry.js';

@Injectable()
export class PrismaRoomRealtimeRepository implements RoomRealtimeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async withRoom<T>(
    roomId: string,
    operation: (locked: LockedRealtimeRoom) => Promise<T>,
  ): Promise<T | null> {
    const result = await runRoomTransactionWithRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Room" WHERE "id"=${roomId}::uuid FOR UPDATE`,
        );
        if (!rows.length) return null;
        const context = await loadLockedRealtimeRoom(
          tx,
          roomId,
          this.config.get('POST_ROOM_KEYWORDS_JOB_DEADLINE_SECONDS', { infer: true }),
        );
        await roomLifecycle.settleAppointment(context);
        try {
          return await operation(context);
        } catch (error) {
          if (error instanceof RoomError) return error;
          throw error;
        }
      }),
    );
    if (result instanceof RoomError) throw result;
    return result;
  }

  async operationStatus(roomId: string) {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const commands = await this.prisma.realtimeCommand.findMany({
      where: { roomId, type: { not: 'HOST_TIMEOUT' }, status: { not: 'COMPLETED' } },
    });
    const providerStatus: 'COMPLETED' | 'PENDING' | 'UNAVAILABLE' = commands.some(
      (c) => c.lastError,
    )
      ? 'UNAVAILABLE'
      : commands.length
        ? 'PENDING'
        : 'COMPLETED';
    return { roomStatus: room.status, providerStatus };
  }
  async finishIssuance(id: string) {
    await this.prisma.realtimeIssuance.deleteMany({ where: { id } });
  }
  async recordIgnoredEvent(event: RealtimeEvent) {
    await this.prisma.roomEvent.createMany({
      data: [{ ...event, roomId: null }],
      skipDuplicates: true,
    });
  }
  async reconciliationHead(roomId: string) {
    const [head] = await this.prisma.$queryRaw<
      ReconciliationHead[]
    >`SELECT r.status,r."endsAt",r."providerRoomSid",clock_timestamp() AS "observedAt",
      md5(concat_ws(':',r."stateVersion",r."providerRoomSid",r."endsAt",COALESCE((SELECT string_agg(concat_ws(':',m.id,m."participantIdentity",m.presence,m."providerSessionSid",u.status),'|' ORDER BY m.id)
        FROM "RoomMembership" m JOIN "User" u ON u.id=m."userId" WHERE m."roomId"=r.id AND m.lifecycle='ACTIVE'),''))) AS version
      FROM "Room" r WHERE r.id=${roomId}::uuid`;
    return head ?? null;
  }
  async mediaSnapshot(roomId: string) {
    const [time] = await this.prisma.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS now`;
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        hostUserId: true,
        kind: true,
        startedAt: true,
        initialHostDeadline: true,
        initialHostResolved: true,
        hostDisconnectedAt: true,
        hostReconnectDeadline: true,
        hostReconnectVersion: true,
        status: true,
        stateVersion: true,
        extensionCount: true,
        capacity: true,
        endsAt: true,
        providerRoomSid: true,
        endedAt: true,
        endedReason: true,
      },
    });
    if (!room) return null;
    const members = await this.prisma.$queryRaw<
      Array<{
        id: string;
        userId: string;
        participantIdentity: string;
        accountActive: boolean;
        lifecycle: 'ACTIVE';
        presence: 'CONNECTED' | 'DISCONNECTED';
        providerSessionSid: string | null;
      }>
    >`SELECT m.id,m."userId",m."participantIdentity",(u.status='ACTIVE') AS "accountActive",m.lifecycle,m.presence,m."providerSessionSid"
      FROM "RoomMembership" m JOIN "User" u ON u.id=m."userId" WHERE m."roomId"=${roomId}::uuid AND m.lifecycle='ACTIVE' ORDER BY m."joinOrder"`;
    return { room, members, observedAt: time!.now };
  }
  async recoverableRooms() {
    return this.prisma.room.findMany({
      where: { status: { in: ['SCHEDULED', 'OPEN', 'ENDING'] } },
      orderBy: { endsAt: 'asc' },
    });
  }
  async scheduledHostTimeouts() {
    const rows = await this.prisma.realtimeCommand.findMany({
      where: { type: 'HOST_TIMEOUT', status: 'PENDING' },
      select: { id: true, nextAttemptAt: true },
    });
    return rows.map((r) => ({ id: r.id, runAt: r.nextAttemptAt }));
  }
  async pendingSchedules(input: { roomId?: string; commandId?: string }) {
    const rows = await this.prisma.realtimeCommand.findMany({
      where: {
        status: { in: ['PENDING', 'RUNNING'] },
        ...(input.roomId ? { roomId: input.roomId } : { id: input.commandId! }),
      },
      select: { id: true, nextAttemptAt: true, lockedUntil: true, status: true },
      orderBy: { nextAttemptAt: 'asc' },
      take: 100,
    });
    return rows.map((row) => {
      const deadline = row.status === 'RUNNING' ? row.lockedUntil : row.nextAttemptAt;
      return {
        id: row.id,
        runAt:
          deadline && deadline.getTime() > Date.now()
            ? deadline
            : new Date((Math.floor(Date.now() / 30000) + 2) * 30000),
      };
    });
  }

  async pendingCommands(roomId?: string) {
    const now = new Date();
    await this.prisma.roomTextMessage.deleteMany({
      where: {
        room: {
          OR: [{ status: { in: ['ENDING', 'ENDED', 'CANCELLED'] } }, { endsAt: { lte: now } }],
        },
      },
    });
    await this.prisma.realtimeIssuance.deleteMany({ where: { expiresAt: { lte: now } } });
    const rows = await this.prisma.realtimeCommand.findMany({
      where: {
        ...(roomId === undefined ? {} : { roomId }),
        OR: [
          { status: 'PENDING', nextAttemptAt: { lte: now } },
          { status: 'RUNNING', lockedUntil: { lte: now } },
        ],
      },
      select: { id: true },
      take: 100,
      orderBy: { nextAttemptAt: 'asc' },
    });
    return rows.map((r) => r.id);
  }
  async claimCommand(id: string): Promise<RealtimeCommand | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "RealtimeCommand" WHERE "id"=${id}::uuid FOR UPDATE SKIP LOCKED`,
      );
      if (!rows.length) return null;
      const command = await tx.realtimeCommand.findUniqueOrThrow({ where: { id } });
      const now = new Date();
      if (
        command.status === 'COMPLETED' ||
        command.status === 'FAILED' ||
        command.nextAttemptAt > now ||
        (command.lockedUntil && command.lockedUntil > now)
      )
        return null;
      // Never delete a room while a credential issuance or identity revocation is outstanding.
      const issuing = await tx.realtimeIssuance.count({
        where: {
          identityRecord: { roomId: command.roomId },
          expiresAt: { gt: now },
          ...(command.type === 'REVOKE_IDENTITY' && command.identity
            ? { identity: command.identity }
            : {}),
        },
      });
      if (issuing && command.type !== 'HOST_TIMEOUT') return null;
      if (
        command.type === 'DELETE_ROOM' &&
        (await tx.realtimeCommand.count({
          where: { roomId: command.roomId, type: 'REVOKE_IDENTITY', status: { not: 'COMPLETED' } },
        }))
      )
        return null;
      const leaseId = randomUUID();
      const saved = await tx.realtimeCommand.update({
        where: { id },
        data: {
          status: 'RUNNING',
          leaseId,
          lockedUntil: new Date(now.getTime() + 30_000),
          attempts: { increment: 1 },
        },
      });
      return saved;
    });
  }
  async completeCommand(command: RealtimeCommand) {
    await this.prisma.$transaction(async (tx) => {
      // Lock order is room, then command, matching domain mutations.
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Room" WHERE "id"=${command.roomId}::uuid FOR UPDATE`,
      );
      const saved = await tx.realtimeCommand.updateMany({
        where: { id: command.id, status: 'RUNNING', leaseId: command.leaseId },
        data: { status: 'COMPLETED', completedAt: new Date(), lockedUntil: null, leaseId: null },
      });
      if (!saved.count) return;
      if (command.type === 'REVOKE_IDENTITY' && command.identity) {
        await tx.realtimeIdentity.updateMany({
          where: { identity: command.identity },
          data: { revokedAt: new Date() },
        });
      } else if (command.type === 'DELETE_ROOM') {
        const ended = await tx.room.updateMany({
          where: { id: command.roomId, status: 'ENDING', stateVersion: command.stateVersion },
          data: { status: 'ENDED', endedAt: new Date() },
        });
        if (ended.count)
          await tx.roomEvent.create({
            data: {
              roomId: command.roomId,
              type: 'room_ended',
              source: 'server',
              result: 'COMPLETED',
              occurredAt: new Date(),
            },
          });
      }
    });
  }
  async failCommand(command: RealtimeCommand) {
    await this.prisma.realtimeCommand.updateMany({
      where: { id: command.id, status: 'RUNNING', leaseId: command.leaseId },
      data: {
        status: command.attempts >= 8 ? 'FAILED' : 'PENDING',
        lastError: 'REALTIME_PROVIDER_UNAVAILABLE',
        lockedUntil: null,
        leaseId: null,
        nextAttemptAt: new Date(Date.now() + Math.min(60_000, 1000 * 2 ** command.attempts)),
      },
    });
  }
}
