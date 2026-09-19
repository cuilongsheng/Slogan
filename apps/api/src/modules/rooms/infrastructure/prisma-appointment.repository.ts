import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type {
  AppointmentRepository,
  AppointmentRecord,
} from '../domain/ports/appointment.repository.js';
import { RoomError } from '../domain/errors/room.error.js';
import { roomLifecycle } from '../domain/policies/room-lifecycle.js';
import { loadLockedRealtimeRoom } from './locked-realtime-room.js';
import { runRoomTransactionWithRetry } from './transaction-retry.js';
import { readEffectiveSafetyRestriction } from '../../safety/index.js';

@Injectable()
export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  async create(input: Parameters<AppointmentRepository['create']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const [{ now } = { now: new Date() }] = await tx.$queryRaw<
        Array<{ now: Date }>
      >`SELECT clock_timestamp() AS now`;
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: { status: true },
      });
      if (user?.status !== 'ACTIVE')
        throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is restricted');
      const restriction = await readEffectiveSafetyRestriction(tx, input.userId, now);
      if (restriction)
        throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is temporarily restricted', {
          severity: restriction.severity,
          endsAt: restriction.endsAt.toISOString(),
        });
      if (input.startedAt <= now || input.endsAt <= input.startedAt)
        throw new RoomError('ROOM_CONFIGURATION_INVALID', 'Invalid appointment time');
      await tx.room.create({
        data: {
          id: input.id,
          hostUserId: input.userId,
          topic: input.topic,
          cefrLevel: input.cefrLevel,
          capacity: input.capacity,
          passwordDigest: input.passwordDigest,
          startedAt: input.startedAt,
          endsAt: input.endsAt,
          kind: 'APPOINTMENT',
          status: 'SCHEDULED',
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
          initialHostDeadline: new Date(input.startedAt.getTime() + 300_000),
          reservations: { create: { userId: input.userId } },
        },
      });
      return this.project(tx, input.id, input.userId);
    });
  }
  async withRoom<T>(
    roomId: string,
    userId: string,
    operation: Parameters<AppointmentRepository['withRoom']>[2],
  ): Promise<T> {
    const result = await runRoomTransactionWithRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Room" WHERE "id"=${roomId}::uuid AND "kind"='APPOINTMENT' FOR UPDATE`,
        );
        if (!rows.length) throw new RoomError('ROOM_NOT_FOUND', 'Appointment room not found');
        const realtime = await loadLockedRealtimeRoom(
          tx,
          roomId,
          this.config.get('POST_ROOM_KEYWORDS_JOB_DEADLINE_SECONDS', { infer: true }),
        );
        await roomLifecycle.settleAppointment(realtime);
        const room = await this.project(tx, roomId, userId);
        const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
        const safetyRestriction = await readEffectiveSafetyRestriction(tx, userId, realtime.now);
        try {
          return await operation({
            room,
            now: realtime.now,
            accountActive: user?.status === 'ACTIVE',
            safetyRestriction,
            book: async () =>
              tx.roomReservation.upsert({
                where: { roomId_userId: { roomId, userId } },
                create: { roomId, userId, bookedAt: realtime.now },
                update: {
                  status: 'BOOKED',
                  version: { increment: 1 },
                  bookedAt: realtime.now,
                  cancelledAt: null,
                },
              }),
            cancelReservation: async () =>
              tx.roomReservation.update({
                where: { roomId_userId: { roomId, userId } },
                data: { status: 'CANCELLED', version: { increment: 1 }, cancelledAt: realtime.now },
              }),
            cancelRoom: async () => {
              await tx.room.update({
                where: { id: roomId },
                data: {
                  status: 'CANCELLED',
                  cancelledAt: realtime.now,
                  cancelledReason: 'HOST_CANCELLED',
                  stateVersion: { increment: 1 },
                },
              });
              await tx.roomReservation.updateMany({
                where: { roomId, status: 'BOOKED' },
                data: { status: 'CANCELLED', version: { increment: 1 }, cancelledAt: realtime.now },
              });
              await realtime.appendEvent({
                type: 'appointment_cancelled',
                source: 'http',
                actorId: userId,
                reason: 'HOST_CANCELLED',
                result: 'COMMITTED',
                occurredAt: realtime.now,
              });
              return this.project(tx, roomId, userId);
            },
          });
        } catch (error) {
          if (error instanceof RoomError) return error;
          throw error;
        }
      }),
    );
    if (result instanceof RoomError) throw result;
    return result as T;
  }
  async list(input: Parameters<AppointmentRepository['list']>[0]) {
    const items: AppointmentRecord[] = [];
    let after = input.cursor;
    // Consume candidates in bounded pages; ended rows may be removed by time settlement.
    while (items.length <= input.limit) {
      const rows: Array<{ id: string; startedAt: Date }> = await this.prisma.room.findMany({
        where: {
          kind: 'APPOINTMENT',
          visibility: 'PUBLIC',
          status: { in: ['SCHEDULED', 'OPEN'] },
          ...(input.filter.cefrLevel === null ? {} : { cefrLevel: input.filter.cefrLevel }),
          ...(input.filter.topic === null
            ? {}
            : { topic: { contains: input.filter.topic, mode: 'insensitive' as const } }),
          ...(after
            ? {
                OR: [
                  { startedAt: { gt: after.startedAt } },
                  { startedAt: after.startedAt, id: { gt: after.id } },
                ],
              }
            : {}),
        },
        select: { id: true, startedAt: true },
        orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
        take: input.limit + 1,
      });
      if (!rows.length) break;
      for (const candidate of rows) {
        after = candidate;
        const item = await this.withRoom<AppointmentRecord>(
          candidate.id,
          input.userId,
          async (ctx) => ctx.room,
        );
        if (item.status === 'SCHEDULED' || item.status === 'OPEN') items.push(item);
        if (items.length > input.limit) break;
      }
      if (items.length > input.limit || rows.length < input.limit + 1) break;
    }
    const hasMore = items.length > input.limit;
    const page = items.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page,
      nextCursor: hasMore && last ? { id: last.id, startedAt: last.startedAt } : null,
    };
  }
  private async project(
    tx: Prisma.TransactionClient,
    roomId: string,
    userId: string,
  ): Promise<AppointmentRecord> {
    const room = await tx.room.findUniqueOrThrow({
      where: { id: roomId },
      include: {
        memberships: { where: { lifecycle: 'ACTIVE' }, select: { userId: true } },
        reservations: true,
      },
    });
    const active = new Set(room.memberships.map((m) => m.userId));
    const reservedCount = room.reservations.filter(
      (r) => r.status === 'BOOKED' && !active.has(r.userId),
    ).length;
    const reservation = room.reservations.find((r) => r.userId === userId);
    return {
      id: room.id,
      hostUserId: room.hostUserId,
      topic: room.topic,
      cefrLevel: room.cefrLevel,
      capacity: room.capacity,
      status: room.status,
      startedAt: room.startedAt,
      endsAt: room.endsAt,
      passwordDigest: room.passwordDigest,
      memberCount: active.size,
      reservedCount,
      availableCount: room.capacity - active.size - reservedCount,
      reservation: reservation
        ? { id: reservation.id, status: reservation.status, version: reservation.version }
        : null,
      visibility: room.visibility,
      shareCode: room.shareCode,
      sensitiveSpeechDetectionEnabled: room.sensitiveSpeechDetectionEnabled,
      postRoomKeywordsEnabled: room.postRoomKeywordsEnabled,
    };
  }
}
