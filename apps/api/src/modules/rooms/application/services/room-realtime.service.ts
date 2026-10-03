import { roomLifecycle } from '../../domain/policies/room-lifecycle.js';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { RoomError } from '../../domain/errors/room.error.js';
import { ROOM_REALTIME_REPOSITORY } from '../../domain/ports/room-realtime.repository.js';
import type {
  RoomRealtimeRepository,
  LockedRealtimeRoom,
  RealtimeCommand,
  RealtimeMember,
} from '../../domain/ports/room-realtime.repository.js';
import { RoomsService } from './rooms.service.js';

export interface RealtimeSignal {
  id: string;
  roomId: string;
  roomSid: string;
  type: 'joined' | 'left' | 'aborted' | 'finished';
  identity?: string | undefined;
  sessionSid?: string | undefined;
  occurredAt: Date;
  source?: 'webhook' | 'reconciliation';
}
export interface CredentialReservation {
  issuanceId: string;
  roomId: string;
  identity: string;
  membershipId: string;
  credentialVersion: number;
  stateVersion: number;
  capacity: number;
  issueUntil: Date;
}

@Injectable()
export class RoomRealtimeService {
  constructor(
    @Inject(ROOM_REALTIME_REPOSITORY) private readonly repository: RoomRealtimeRepository,
    private readonly rooms: RoomsService,
  ) {}

  async reserveCredential(roomId: string, userId: string): Promise<CredentialReservation> {
    const detail = await this.rooms.detail(userId, roomId);
    await this.rooms.assertSpeechAccess(userId, detail.room);
    const result = await this.repository.withRoom(roomId, async (ctx) => {
      this.assertOpen(ctx);
      const restriction = await ctx.safetyRestriction(userId);
      if (restriction)
        throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is temporarily restricted', {
          severity: restriction.severity,
          endsAt: restriction.endsAt.toISOString(),
        });
      const member = ctx.members.find(
        (m) => m.userId === userId && m.accountActive && m.lifecycle === 'ACTIVE',
      );
      if (!member)
        throw new RoomError('ROOM_MEMBERSHIP_REQUIRED', 'Current room membership is required');
      const old = ctx.identities.find((i) => i.identity === member.participantIdentity);
      if (old?.revokedAt)
        throw new RoomError('ROOM_MEMBERSHIP_REQUIRED', 'Credential identity has been revoked');
      const issueUntil = new Date(ctx.now.getTime() + 30_000);
      await ctx.rememberIdentity({
        identity: member.participantIdentity,
        roomId,
        membershipId: member.id,
        credentialVersion: member.credentialVersion,
        issueUntil,
        revokedAt: null,
      });
      const issuanceId = randomUUID();
      await ctx.reserveIssuance(issuanceId, member.participantIdentity, issueUntil);
      return {
        issuanceId,
        roomId,
        identity: member.participantIdentity,
        membershipId: member.id,
        credentialVersion: member.credentialVersion,
        stateVersion: ctx.room.stateVersion,
        capacity: ctx.room.capacity,
        issueUntil,
      };
    });
    if (!result) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    return result;
  }
  finishCredential(issuanceId: string) {
    return this.repository.finishIssuance(issuanceId);
  }
  async confirmCredential(reservation: CredentialReservation, userId: string, roomSid: string) {
    const detail = await this.rooms.detail(userId, reservation.roomId);
    await this.rooms.assertSpeechAccess(userId, detail.room);
    const result = await this.repository.withRoom(reservation.roomId, async (ctx) => {
      this.assertOpen(ctx);
      const restriction = await ctx.safetyRestriction(userId);
      if (restriction)
        throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is temporarily restricted', {
          severity: restriction.severity,
          endsAt: restriction.endsAt.toISOString(),
        });
      const member = ctx.members.find(
        (m) =>
          m.id === reservation.membershipId &&
          m.userId === userId &&
          m.accountActive &&
          m.lifecycle === 'ACTIVE',
      );
      if (
        !member ||
        member.participantIdentity !== reservation.identity ||
        member.credentialVersion !== reservation.credentialVersion ||
        ctx.room.stateVersion !== reservation.stateVersion ||
        ctx.now >= reservation.issueUntil
      ) {
        throw new RoomError('ROOM_MEMBERSHIP_REQUIRED', 'Credential authorization changed');
      }
      if (ctx.room.providerRoomSid && ctx.room.providerRoomSid !== roomSid) {
        await this.endLocked(ctx, 'PROVIDER_ROOM_REPLACED');
        return false;
      }
      await ctx.saveRoom({ providerRoomSid: roomSid });
      return {
        lifecycle: member.lifecycle,
        role: member.role,
        credentialVersion: member.credentialVersion,
        hostReconnectDeadline: ctx.room.hostReconnectDeadline?.toISOString() ?? null,
      };
    });
    if (!result) throw new RoomError('ROOM_ENDED', 'The realtime room has ended');
    return result;
  }
  async members(roomId: string, userId: string) {
    await this.rooms.detail(userId, roomId);
    const result = await this.repository.withRoom(roomId, async (ctx) => {
      this.assertOpen(ctx);
      if (
        !ctx.members.some((m) => m.userId === userId && m.accountActive && m.lifecycle === 'ACTIVE')
      )
        throw new RoomError('ROOM_MEMBERSHIP_REQUIRED', 'Current room membership is required');
      return ctx.members
        .filter((m) => m.lifecycle === 'ACTIVE')
        .map((m, index) => ({
          membershipId: m.id,
          userId: m.userId,
          lifecycle: m.lifecycle,
          credentialVersion: m.credentialVersion,
          hostReconnectDeadline: ctx.room.hostReconnectDeadline?.toISOString() ?? null,
          displayName: m.displayName,
          cefrLevel: m.cefrLevel,
          role: m.role,
          position: index + 1,
          presence: m.presence,
          participantIdentity: m.participantIdentity,
        }));
    });
    if (!result) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    return result;
  }
  async removedMembers(roomId: string, userId: string) {
    await this.rooms.detail(userId, roomId);
    const result = await this.repository.withRoom(roomId, async (ctx) => {
      this.assertOpen(ctx);
      if (
        ctx.room.hostUserId !== userId ||
        !ctx.members.some(
          (m) => m.userId === userId && m.role === 'HOST' && m.lifecycle === 'ACTIVE',
        )
      )
        throw new RoomError('ROOM_HOST_REQUIRED', 'Current host permission required');
      return ctx.members
        .filter((m) => m.lifecycle === 'REMOVED')
        .map((m) => ({
          membershipId: m.id,
          userId: m.userId,
          displayName: m.displayName,
          cefrLevel: m.cefrLevel,
          credentialVersion: m.credentialVersion,
        }));
    });
    if (!result) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    return result;
  }
  async endRoom(roomId: string, reason: string, onlyIfExpired = false) {
    return this.repository.withRoom(roomId, async (ctx) => {
      if (onlyIfExpired && ctx.room.endsAt > ctx.now) return false;
      await this.endLocked(ctx, reason);
      return true;
    });
  }
  endLocked(ctx: LockedRealtimeRoom, reason: string, actorId?: string) {
    return roomLifecycle.endLocked(ctx, reason, actorId);
  }
  settleAppointment(roomId: string) {
    return this.repository.withRoom(roomId, (ctx) => roomLifecycle.settleAppointment(ctx));
  }
  async applySignal(signal: RealtimeSignal) {
    const result = await this.repository.withRoom(signal.roomId, async (ctx) => {
      const member = ctx.members.find((m) => m.participantIdentity === signal.identity);
      const first = await ctx.appendEvent({
        providerEventId: signal.id,
        type: signal.type,
        source: signal.source ?? 'webhook',
        ...(member ? { targetId: member.id } : {}),
        result: 'OBSERVED',
        occurredAt: signal.occurredAt,
      });
      if (!first) return false;
      await roomLifecycle.settleAppointment(ctx);
      if (ctx.room.status !== 'OPEN') {
        if (signal.identity && ctx.identities.some((i) => i.identity === signal.identity))
          await ctx.enqueue('REVOKE_IDENTITY', signal.identity);
        return false;
      }
      if (!ctx.room.providerRoomSid || ctx.room.providerRoomSid !== signal.roomSid) return false;
      if (signal.type === 'finished') {
        await this.endLocked(ctx, 'PROVIDER_FINISHED');
        return true;
      }
      if (!member || !member.accountActive || member.lifecycle !== 'ACTIVE') {
        if (signal.identity && ctx.identities.some((i) => i.identity === signal.identity))
          await ctx.enqueue('REVOKE_IDENTITY', signal.identity);
        return false;
      }
      if (ctx.room.endsAt <= ctx.now) {
        await this.endLocked(ctx, 'EXPIRED');
        return false;
      }
      if (
        signal.occurredAt > new Date(ctx.now.getTime() + 60_000) ||
        (member.presenceUpdatedAt &&
          (signal.occurredAt < member.presenceUpdatedAt ||
            (signal.occurredAt.getTime() === member.presenceUpdatedAt.getTime() &&
              !(
                signal.type !== 'joined' &&
                signal.sessionSid === member.providerSessionSid &&
                member.presence === 'CONNECTED'
              ))))
      )
        return false;
      if (
        signal.type !== 'joined' &&
        member.providerSessionSid &&
        signal.sessionSid !== member.providerSessionSid
      )
        return false;
      if (
        member.userId === ctx.room.hostUserId &&
        ctx.room.hostReconnectDeadline &&
        ctx.now >= ctx.room.hostReconnectDeadline &&
        (signal.type !== 'joined' || signal.occurredAt >= ctx.room.hostReconnectDeadline)
      ) {
        await this.settleHostLocked(ctx);
        if (ctx.room.status !== 'OPEN') return false;
      }
      await ctx.saveMember(member.id, {
        presence: signal.type === 'joined' ? 'CONNECTED' : 'DISCONNECTED',
        providerSessionSid: signal.sessionSid ?? null,
        presenceUpdatedAt: signal.occurredAt,
      });
      if (
        member.userId === ctx.room.hostUserId &&
        signal.type === 'joined' &&
        ctx.room.kind === 'APPOINTMENT'
      ) {
        await ctx.saveRoom({ initialHostResolved: true });
      }
      await roomLifecycle.settleAppointment(ctx);
      if (ctx.room.status !== 'OPEN') return true;
      if (member.userId === ctx.room.hostUserId) {
        if (
          signal.type === 'joined' &&
          ctx.room.hostReconnectDeadline &&
          signal.occurredAt < ctx.room.hostReconnectDeadline
        ) {
          await this.clearWindow(ctx);
          await ctx.appendEvent({
            type: 'host_reconnected',
            source: signal.source ?? 'webhook',
            targetId: member.id,
            result: 'RESTORED',
            occurredAt: signal.occurredAt,
          });
        } else if (
          signal.type !== 'joined' &&
          !ctx.room.hostReconnectDeadline &&
          (ctx.room.kind !== 'APPOINTMENT' || ctx.room.initialHostResolved)
        ) {
          await ctx.saveRoom({
            hostDisconnectedAt: signal.occurredAt,
            hostReconnectDeadline: new Date(signal.occurredAt.getTime() + 60_000),
            hostReconnectVersion: ctx.room.hostReconnectVersion + 1,
          });
          await ctx.appendEvent({
            type: 'host_disconnected',
            source: signal.source ?? 'webhook',
            targetId: member.id,
            result: 'RECONNECTING',
            occurredAt: signal.occurredAt,
          });
          await ctx.enqueue('HOST_TIMEOUT', member.participantIdentity);
          if (ctx.room.hostReconnectDeadline! <= ctx.now) await this.settleHostLocked(ctx);
        }
      }
      return true;
    });
    if (result === null)
      await this.repository.recordIgnoredEvent({
        providerEventId: signal.id,
        type: signal.type,
        source: signal.source ?? 'webhook',
        reason: 'UNKNOWN_ROOM',
        result: 'IGNORED',
        occurredAt: signal.occurredAt,
      });
    return result;
  }
  clearWindow(ctx: LockedRealtimeRoom) {
    return roomLifecycle.clearWindow(ctx);
  }
  transferLocked(
    ctx: LockedRealtimeRoom,
    previous: RealtimeMember | undefined,
    next: RealtimeMember,
    reason: string,
    actorId?: string,
  ) {
    return roomLifecycle.transferLocked(ctx, previous, next, reason, actorId);
  }
  private async settleHostLocked(ctx: LockedRealtimeRoom) {
    if (ctx.room.status !== 'OPEN') return;
    if (ctx.room.endsAt <= ctx.now) {
      await this.endLocked(ctx, 'EXPIRED');
      return;
    }
    if (!ctx.room.hostReconnectDeadline || ctx.room.hostReconnectDeadline > ctx.now) return;
    const previous = ctx.members.find((m) => m.userId === ctx.room.hostUserId)!;
    const next = ctx.members.find(
      (m) =>
        m.userId !== ctx.room.hostUserId &&
        m.lifecycle === 'ACTIVE' &&
        m.accountActive &&
        m.presence === 'CONNECTED',
    );
    if (next) await this.transferLocked(ctx, previous, next, 'HOST_TIMEOUT');
    else await this.endLocked(ctx, 'HOST_TIMEOUT_NO_SUCCESSOR');
  }
  async hostTimeout(command: RealtimeCommand) {
    await this.repository.withRoom(command.roomId, async (ctx) => {
      const host = ctx.members.find((m) => m.userId === ctx.room.hostUserId);
      if (
        ctx.room.hostReconnectVersion !== command.stateVersion ||
        host?.participantIdentity !== command.identity
      )
        return;
      await this.settleHostLocked(ctx);
    });
  }
  async operationStatus(roomId: string) {
    return this.repository.operationStatus(roomId);
  }
  async snapshot(roomId: string) {
    return this.repository.withRoom(roomId, async (ctx) => ({
      room: ctx.room,
      members: ctx.members,
      identities: ctx.identities,
      observedAt: ctx.now,
    }));
  }
  recoverableRooms() {
    return this.repository.recoverableRooms();
  }
  scheduledHostTimeouts() {
    return this.repository.scheduledHostTimeouts();
  }
  pendingCommands(roomId?: string) {
    return this.repository.pendingCommands(roomId);
  }
  claimCommand(id: string) {
    return this.repository.claimCommand(id);
  }
  completeCommand(command: RealtimeCommand) {
    return this.repository.completeCommand(command);
  }
  failCommand(command: RealtimeCommand) {
    return this.repository.failCommand(command);
  }
  private assertOpen(ctx: LockedRealtimeRoom) {
    if (ctx.room.status !== 'OPEN' || ctx.room.endsAt <= ctx.now)
      throw new RoomError('ROOM_ENDED', 'The room has ended');
  }
}
