import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  APPOINTMENT_REPOSITORY,
  type AppointmentRepository,
  type AppointmentInput,
  type AppointmentRecord,
  type LockedAppointment,
  type ReservationRecord,
} from '../../domain/ports/appointment.repository.js';
import {
  ROOM_PASSWORD_HASHER,
  type RoomPasswordHasher,
} from '../../domain/ports/room-password.port.js';
import { RoomPolicy } from '../../domain/policies/room.policy.js';
import { RoomError } from '../../domain/errors/room.error.js';
import { RoomsService } from './rooms.service.js';

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repository: AppointmentRepository,
    @Inject(ROOM_PASSWORD_HASHER) private readonly passwords: RoomPasswordHasher,
    private readonly rooms: RoomsService,
    private readonly policy: RoomPolicy,
  ) {}
  async create(userId: string, input: AppointmentInput) {
    await this.rooms.assertEligible(userId);
    await this.rooms.assertSpeechCapability(input.sensitiveSpeechDetectionEnabled ?? false);
    await this.rooms.assertPostRoomKeywordsCapability(input.postRoomKeywordsEnabled ?? false);
    await this.rooms.assertSpeechConsentForCreation(userId, input.sensitiveSpeechDetectionEnabled);
    await this.rooms.assertPostRoomKeywordsConsentForCreation(
      userId,
      input.postRoomKeywordsEnabled,
    );
    const valid = this.policy.validateCreation(input, new Date());
    const startedAt = this.date(input.startsAt);
    const endsAt = this.date(input.endsAt);
    const id = randomUUID();
    const room = await this.repository.create({
      ...valid,
      id,
      userId,
      shareCode: randomUUID(),
      keywordExtractorVersion: this.rooms.postRoomKeywordExtractorVersion(),
      startedAt,
      endsAt,
      passwordDigest:
        input.password === undefined ? null : this.passwords.digest(id, input.password),
    });
    return { ...room, shareUrl: this.rooms.shareUrl(room.shareCode) };
  }
  async detail(userId: string, roomId: string) {
    await this.rooms.assertEligible(userId);
    const room = await this.repository.withRoom<AppointmentRecord>(roomId, userId, async (ctx) => {
      this.active(ctx);
      return ctx.room;
    });
    return { ...room, shareUrl: this.rooms.shareUrl(room.shareCode) };
  }
  async list(
    userId: string,
    input: { limit?: number; cursor?: string; cefrLevel?: string; topic?: string },
  ) {
    await this.rooms.assertEligible(userId);
    const filter = this.rooms.normalizeDiscovery(input);
    const page = await this.repository.list({
      userId,
      limit: input.limit ?? 20,
      cursor:
        input.cursor === undefined
          ? null
          : this.rooms.decodeDiscoveryCursor('APPOINTMENT', input.cursor, filter),
      filter,
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor
        ? this.rooms.encodeDiscoveryCursor('APPOINTMENT', page.nextCursor, filter)
        : null,
    };
  }
  async reserve(
    userId: string,
    roomId: string,
    input: { expectedReservationVersion: number; rulesAccepted: boolean; password?: string },
  ) {
    await this.rooms.assertEligible(userId);
    return this.repository.withRoom<ReservationRecord>(roomId, userId, async (ctx) => {
      this.active(ctx);
      this.safetyEligible(ctx);
      await this.rooms.assertSpeechAccess(userId, ctx.room);
      this.available(ctx);
      if (ctx.now >= ctx.room.startedAt)
        throw new RoomError('APPOINTMENT_BOOKING_CLOSED', 'Reservations close at start time');
      this.policy.assertCanJoin({
        status: 'OPEN',
        now: ctx.now,
        endsAt: ctx.room.endsAt,
        rulesAccepted: input.rulesAccepted,
        passwordProtected: ctx.room.passwordDigest !== null,
        passwordProvided: input.password !== undefined,
        passwordValid:
          !!ctx.room.passwordDigest &&
          input.password !== undefined &&
          this.passwords.matches(roomId, input.password, ctx.room.passwordDigest),
        memberCount: 0,
        capacity: ctx.room.capacity,
      });
      const current = ctx.room.reservation;
      if (current?.status === 'BOOKED' && current.version === input.expectedReservationVersion + 1)
        return current;
      if (
        (current?.version ?? 0) !== input.expectedReservationVersion ||
        (current && current.status !== 'CANCELLED')
      )
        throw new RoomError('RESERVATION_CONFLICT', 'Reservation version changed');
      if (ctx.room.availableCount <= 0) throw new RoomError('ROOM_FULL', 'Room is fully reserved');
      return ctx.book();
    });
  }
  async cancelReservation(userId: string, roomId: string, version: number) {
    await this.rooms.assertEligible(userId);
    return this.repository.withRoom<ReservationRecord>(roomId, userId, async (ctx) => {
      this.active(ctx);
      const current = ctx.room.reservation;
      if (current?.status === 'CANCELLED' && current.version === version + 1) return current;
      this.available(ctx);
      if (current?.status === 'CONSUMED')
        throw new RoomError('RESERVATION_ALREADY_USED', 'Use leave for an active session');
      if (!current || current.version !== version || current.status !== 'BOOKED')
        throw new RoomError('RESERVATION_CONFLICT', 'Reservation version changed');
      if (ctx.room.hostUserId === userId)
        throw new RoomError(
          'RESERVATION_OWNER_REQUIRED',
          'Host must cancel the entire scheduled room',
        );
      return ctx.cancelReservation();
    });
  }
  async cancelRoom(userId: string, roomId: string) {
    await this.rooms.assertEligible(userId);
    return this.repository.withRoom<AppointmentRecord>(roomId, userId, async (ctx) => {
      this.active(ctx);
      if (ctx.room.hostUserId !== userId)
        throw new RoomError('ROOM_HOST_REQUIRED', 'Host permission required');
      if (ctx.room.status === 'CANCELLED') return ctx.room;
      if (ctx.now >= ctx.room.startedAt)
        throw new RoomError('APPOINTMENT_ALREADY_STARTED', 'The appointment has started');
      this.available(ctx);
      return ctx.cancelRoom();
    });
  }
  private active(ctx: LockedAppointment) {
    if (!ctx.accountActive) throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is restricted');
  }
  private safetyEligible(ctx: LockedAppointment) {
    if (ctx.safetyRestriction)
      throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is temporarily restricted', {
        severity: ctx.safetyRestriction.severity,
        endsAt: ctx.safetyRestriction.endsAt.toISOString(),
      });
  }
  private available(ctx: LockedAppointment) {
    if (ctx.room.status === 'CANCELLED')
      throw new RoomError('ROOM_CANCELLED', 'Appointment cancelled');
    if (ctx.room.status === 'ENDING' || ctx.room.status === 'ENDED')
      throw new RoomError('ROOM_ENDED', 'Appointment ended');
  }
  private date(value: string) {
    if (
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
      !Number.isFinite(Date.parse(value))
    )
      throw new RoomError('ROOM_CONFIGURATION_INVALID', 'Explicit timezone required');
    return new Date(value);
  }
}
