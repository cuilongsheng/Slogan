const jest = import.meta.jest;
import { roomLifecycle } from '../../src/modules/rooms/testing.js';
import type { LockedRealtimeRoom } from '../../src/modules/rooms/index.js';
function fixture(now: number, online = false): LockedRealtimeRoom {
  const ctx: LockedRealtimeRoom = {
    now: new Date(now),
    safetyRestriction: jest.fn(async () => null),
    reservedUserIds: [],
    identities: [],
    members: [],
    room: {
      id: 'room',
      kind: 'APPOINTMENT',
      hostUserId: 'owner',
      startedAt: new Date(0),
      initialHostDeadline: new Date(300_000),
      initialHostResolved: false,
      status: 'SCHEDULED',
      endsAt: new Date(600_000),
      stateVersion: 0,
      extensionCount: 0,
      capacity: 2,
      hostDisconnectedAt: null,
      hostReconnectDeadline: null,
      hostReconnectVersion: 0,
      providerRoomSid: null,
      endedAt: null,
      endedReason: null,
    },
    saveRoom: async (patch) => {
      Object.assign(ctx.room, patch);
    },
    saveMember: async (id, patch) => {
      Object.assign(
        ctx.members.find((m) => m.id === id)!,
        patch,
      );
    },
    expireReservations: jest.fn(async () => {}),
    reserveIssuance: jest.fn(async () => {}),
    rememberIdentity: jest.fn(async () => {}),
    appendEvent: jest.fn(async () => true),
    enqueue: jest.fn(async () => {}),
  };
  if (online)
    ctx.members.push({
      id: 'member',
      userId: 'member',
      role: 'MEMBER',
      lifecycle: 'ACTIVE',
      leftAt: null,
      removedAt: null,
      removalReason: null,
      joinOrder: 2,
      displayName: 'Member',
      cefrLevel: 'B1',
      accountActive: true,
      participantIdentity: 'identity',
      credentialVersion: 0,
      presence: 'CONNECTED',
      providerSessionSid: 'session',
      presenceUpdatedAt: new Date(1),
    });
  return ctx;
}
describe('appointment exact deadlines', () => {
  it.each([-1, 0, 1, 299_999, 300_000, 300_001, 599_999, 600_000, 600_001])(
    'settles empty room at %i ms without adding a window',
    async (now) => {
      const ctx = fixture(now);
      await roomLifecycle.settleAppointment(ctx);
      expect(ctx.room.status).toBe(now < 0 ? 'SCHEDULED' : now < 300_000 ? 'OPEN' : 'ENDED');
      if (now >= 300_000)
        expect(ctx.room.endedReason).toBe(now >= 600_000 ? 'EXPIRED' : 'EMPTY_AFTER_START_WINDOW');
    },
  );
  it('transfers once at the boundary and does not couple the timer to ordinary state versions', async () => {
    const ctx = fixture(300_000, true);
    ctx.room.stateVersion = 52;
    await roomLifecycle.settleAppointment(ctx);
    await roomLifecycle.settleAppointment(ctx);
    expect(ctx.room.hostUserId).toBe('member');
    expect(ctx.members[0]?.role).toBe('HOST');
    expect(ctx.appendEvent).toHaveBeenCalledTimes(2);
  });
  it('keeps checking emptiness after host arrival resolved the initial transfer', async () => {
    const ctx = fixture(300_000);
    ctx.room.initialHostResolved = true;
    await roomLifecycle.settleAppointment(ctx);
    expect(ctx.room.status).toBe('ENDED');
  });
  it('never skips provider cleanup for an issued identity even without a provider SID', async () => {
    const ctx = fixture(300_000);
    ctx.identities.push({
      identity: 'old',
      roomId: 'room',
      membershipId: 'member',
      credentialVersion: 0,
      issueUntil: new Date(900_000),
      revokedAt: null,
    });
    await roomLifecycle.settleAppointment(ctx);
    expect(ctx.room.status).toBe('ENDING');
    expect(ctx.enqueue).toHaveBeenCalledWith('REVOKE_IDENTITY', 'old');
    expect(ctx.enqueue).toHaveBeenCalledWith('DELETE_ROOM');
  });
});
