import type { LockedRealtimeRoom, RealtimeMember } from '../ports/room-realtime.repository.js';

export class RoomLifecycle {
  async endLocked(ctx: LockedRealtimeRoom, reason: string, actorId?: string) {
    if (ctx.room.status !== 'OPEN' && ctx.room.status !== 'SCHEDULED') return;
    await ctx.expireReservations();
    const noMedia =
      ctx.room.kind === 'APPOINTMENT' && !ctx.room.providerRoomSid && ctx.identities.length === 0;
    await ctx.saveRoom({
      hostDisconnectedAt: null,
      hostReconnectDeadline: null,
      hostReconnectVersion: ctx.room.hostReconnectVersion + 1,
      status: noMedia ? 'ENDED' : 'ENDING',
      ...(noMedia ? { endedAt: ctx.now } : {}),
      stateVersion: ctx.room.stateVersion + 1,
      endedReason: reason,
    });
    await ctx.appendEvent({
      ...(actorId ? { actorId } : {}),
      type: noMedia ? 'room_ended' : 'room_ending',
      source: 'server',
      reason,
      result: noMedia ? 'COMPLETED' : 'PENDING',
      occurredAt: ctx.now,
    });
    if (noMedia) return;
    for (const identity of ctx.identities.filter((i) => !i.revokedAt))
      await ctx.enqueue('REVOKE_IDENTITY', identity.identity);
    await ctx.enqueue('DELETE_ROOM');
  }
  async clearWindow(ctx: LockedRealtimeRoom) {
    await ctx.saveRoom({
      hostDisconnectedAt: null,
      hostReconnectDeadline: null,
      hostReconnectVersion: ctx.room.hostReconnectVersion + 1,
    });
  }
  async transferLocked(
    ctx: LockedRealtimeRoom,
    previous: RealtimeMember | undefined,
    next: RealtimeMember,
    reason: string,
    actorId?: string,
  ) {
    if (previous) await ctx.saveMember(previous.id, { role: 'MEMBER' });
    await ctx.saveMember(next.id, { role: 'HOST' });
    await ctx.saveRoom({
      hostUserId: next.userId,
      initialHostResolved: true,
      stateVersion: ctx.room.stateVersion + 1,
    });
    await this.clearWindow(ctx);
    await ctx.appendEvent({
      type: 'host_transferred',
      source: 'server',
      ...(actorId ? { actorId } : {}),
      targetId: next.id,
      reason,
      result: 'COMMITTED',
      occurredAt: ctx.now,
    });
  }

  async settleAppointment(ctx: LockedRealtimeRoom) {
    if (ctx.room.kind !== 'APPOINTMENT' || !['SCHEDULED', 'OPEN'].includes(ctx.room.status)) return;
    if (ctx.room.endsAt <= ctx.now) {
      await this.endLocked(ctx, 'EXPIRED');
      return;
    }
    if (ctx.room.startedAt > ctx.now) return;
    if (ctx.room.status === 'SCHEDULED') {
      await ctx.saveRoom({ status: 'OPEN', stateVersion: ctx.room.stateVersion + 1 });
      await ctx.appendEvent({
        type: 'appointment_opened',
        source: 'server',
        result: 'COMMITTED',
        occurredAt: ctx.now,
      });
    }
    if (ctx.room.initialHostDeadline! > ctx.now) return;
    const online = ctx.members.filter(
      (m) => m.lifecycle === 'ACTIVE' && m.accountActive && m.presence === 'CONNECTED',
    );
    if (!online.length) {
      await this.endLocked(ctx, 'EMPTY_AFTER_START_WINDOW');
      return;
    }
    if (!ctx.room.initialHostResolved) {
      const previous = ctx.members.find((m) => m.userId === ctx.room.hostUserId);
      const host = online.find((m) => m.userId === ctx.room.hostUserId);
      if (host) await ctx.saveRoom({ initialHostResolved: true });
      else await this.transferLocked(ctx, previous, online[0]!, 'INITIAL_HOST_ABSENT');
    }
  }
}
export const roomLifecycle = new RoomLifecycle();
