import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { AppModule } from '../../src/app.module.js';
import type { Environment } from '../../src/config/environment.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { RealtimeQueue } from '../../src/infrastructure/redis/realtime-queue.service.js';
import { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import {
  HostControlsService,
  RoomsService,
  RoomRealtimeService,
  ROOM_REALTIME_REPOSITORY,
  type RoomRealtimeRepository,
} from '../../src/modules/rooms/index.js';
import { VoiceService, RealtimeRunner } from '../../src/modules/voice/testing.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import {
  clearRealtimeFixtures,
  FakeRealtimeProvider,
  realtimeEnvironment,
  seedAdult,
} from '../fixtures/realtime.js';

describe('host controls PostgreSQL transactions', () => {
  let moduleRef: TestingModule,
    prisma: PrismaService,
    rooms: RoomsService,
    realtime: RoomRealtimeService,
    host: HostControlsService,
    repo: RoomRealtimeRepository,
    voice: VoiceService,
    provider: FakeRealtimeProvider;
  let roomId: string, hostId: string, memberId: string, thirdId: string;
  beforeAll(async () => {
    installTestEnvironment();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    rooms = moduleRef.get(RoomsService);
    realtime = moduleRef.get(RoomRealtimeService);
    host = moduleRef.get(HostControlsService);
    repo = moduleRef.get(ROOM_REALTIME_REPOSITORY);
    await prisma.$connect();
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    hostId = (await seedAdult(prisma, 'Host')).id;
    memberId = (await seedAdult(prisma, 'Member')).id;
    thirdId = (await seedAdult(prisma, 'Third')).id;
    roomId = (
      await rooms.create(hostId, { topic: 'Host control tests', capacity: 4, cefrLevel: 'B1' })
    ).room.id;
    await rooms.join(memberId, roomId, { rulesAccepted: true });
    await rooms.join(thirdId, roomId, { rulesAccepted: true });
    await prisma.room.update({ where: { id: roomId }, data: { providerRoomSid: 'RM_test' } });
    provider = new FakeRealtimeProvider();
    voice = new VoiceService(
      realtime,
      provider,
      new ConfigService<Environment, true>(realtimeEnvironment()),
    );
  });
  afterAll(async () => moduleRef.close());
  const membership = (userId: string) =>
    prisma.roomMembership.findUniqueOrThrow({ where: { roomId_userId: { roomId, userId } } });
  const room = () => prisma.room.findUniqueOrThrow({ where: { id: roomId } });
  async function connect(userId: string, at = new Date(Date.now() - 70_000)) {
    const m = await membership(userId);
    await realtime.applySignal({
      id: randomUUID(),
      roomId,
      roomSid: 'RM_test',
      identity: m.participantIdentity,
      sessionSid: `PA_${m.id}`,
      type: 'joined',
      occurredAt: at,
    });
  }
  async function disconnect(at = new Date()) {
    const m = await membership(hostId);
    await realtime.applySignal({
      id: randomUUID(),
      roomId,
      roomSid: 'RM_test',
      identity: m.participantIdentity,
      sessionSid: `PA_${m.id}`,
      type: 'left',
      occurredAt: at,
    });
  }
  const leave = async (userId: string, successorMembershipId?: string) =>
    host.execute(roomId, userId, {
      kind: 'leave',
      expectedCredentialVersion: (await membership(userId)).credentialVersion,
      ...(successorMembershipId ? { successorMembershipId } : {}),
    });
  it('releases capacity, reorders after rejoin and fences repeated leave and late signals', async () => {
    const before = await membership(memberId);
    await voice.credentials(roomId, memberId);
    await leave(memberId);
    await host.execute(roomId, memberId, { kind: 'leave', expectedCredentialVersion: 0 });
    expect((await rooms.detail(hostId, roomId)).room.memberCount).toBe(2);
    expect((await realtime.members(roomId, hostId)).map((m) => m.position)).toEqual([1, 2]);
    await rooms.join(memberId, roomId, { rulesAccepted: true });
    const after = await membership(memberId);
    expect(after.joinOrder).toBe(4);
    expect(after.participantIdentity).not.toBe(before.participantIdentity);
    await expect(
      host.execute(roomId, memberId, { kind: 'leave', expectedCredentialVersion: 0 }),
    ).rejects.toMatchObject({ code: 'ROOM_OPERATION_CONFLICT' });
    await voice.dispatchPending(roomId);
    expect(provider.revoked).toContain(before.participantIdentity);
    expect(provider.revoked).not.toContain(after.participantIdentity);
    await realtime.applySignal({
      id: randomUUID(),
      roomId,
      roomSid: 'RM_test',
      identity: before.participantIdentity,
      type: 'joined',
      sessionSid: 'PA_stale',
      occurredAt: new Date(),
    });
    expect((await membership(memberId)).presence).toBe('DISCONNECTED');
    expect(await prisma.roomEvent.count({ where: { type: 'member_leave' } })).toBe(1);
  });
  it('blocks removed credentials and self-join, reinvites without reserving and checks generation', async () => {
    const m = await membership(memberId);
    await voice.credentials(roomId, memberId);
    await host.execute(roomId, hostId, {
      kind: 'remove',
      targetId: m.id,
      expectedCredentialVersion: 0,
    });
    expect(await realtime.removedMembers(roomId, hostId)).toEqual([
      expect.objectContaining({ membershipId: m.id, userId: memberId, credentialVersion: 1 }),
    ]);
    await expect(realtime.removedMembers(roomId, thirdId)).rejects.toMatchObject({
      code: 'ROOM_HOST_REQUIRED',
    });
    await host.execute(roomId, hostId, {
      kind: 'remove',
      targetId: m.id,
      expectedCredentialVersion: 0,
    });
    await expect(rooms.join(memberId, roomId, { rulesAccepted: true })).rejects.toMatchObject({
      code: 'ROOM_INVITATION_REQUIRED',
    });
    await expect(realtime.reserveCredential(roomId, memberId)).rejects.toMatchObject({
      code: 'ROOM_MEMBERSHIP_REQUIRED',
    });
    await host.execute(roomId, hostId, {
      kind: 'invite',
      targetId: m.id,
      expectedCredentialVersion: 1,
    });
    expect(await realtime.removedMembers(roomId, hostId)).toEqual([]);
    await host.execute(roomId, hostId, {
      kind: 'invite',
      targetId: m.id,
      expectedCredentialVersion: 1,
    });
    expect((await rooms.detail(hostId, roomId)).room.memberCount).toBe(2);
    await expect(rooms.join(memberId, roomId, { rulesAccepted: false })).rejects.toMatchObject({
      code: 'ROOM_RULES_NOT_ACCEPTED',
    });
    await rooms.join(memberId, roomId, { rulesAccepted: true });
    await expect(
      host.execute(roomId, hostId, {
        kind: 'remove',
        targetId: m.id,
        expectedCredentialVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_OPERATION_CONFLICT' });
    await voice.dispatchPending(roomId);
    expect(provider.revoked).toContain(m.participantIdentity);
    expect((await membership(memberId)).lifecycle).toBe('ACTIVE');
    expect(await prisma.roomEvent.count({ where: { type: 'member_remove' } })).toBe(1);
    expect(await prisma.roomEvent.count({ where: { type: 'member_invite' } })).toBe(1);
  });
  it('denies non-host, self-removal and cross-room requests and audits rejections', async () => {
    const m = await membership(memberId),
      h = await membership(hostId);
    await expect(
      host.execute(roomId, memberId, {
        kind: 'remove',
        targetId: h.id,
        expectedCredentialVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_HOST_REQUIRED' });
    await expect(
      host.execute(roomId, hostId, {
        kind: 'remove',
        targetId: h.id,
        expectedCredentialVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_OPERATION_CONFLICT' });
    await expect(
      host.execute(roomId, hostId, {
        kind: 'remove',
        targetId: randomUUID(),
        expectedCredentialVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_MEMBER_NOT_ACTIVE' });
    await expect(leave(memberId, h.id)).rejects.toMatchObject({ code: 'ROOM_SUCCESSOR_INVALID' });
    expect((await membership(memberId)).id).toBe(m.id);
    expect(await prisma.roomEvent.count({ where: { result: 'DENIED' } })).toBe(4);
  });
  it('checks invitation eligibility and rechecks capacity under competing joins', async () => {
    const m = await membership(memberId);
    await host.execute(roomId, hostId, {
      kind: 'remove',
      targetId: m.id,
      expectedCredentialVersion: 0,
    });
    await prisma.user.update({ where: { id: memberId }, data: { status: 'DISABLED' } });
    await expect(
      host.execute(roomId, hostId, {
        kind: 'invite',
        targetId: m.id,
        expectedCredentialVersion: 1,
      }),
    ).rejects.toBeDefined();
    await prisma.user.update({ where: { id: memberId }, data: { status: 'ACTIVE' } });
    await host.execute(roomId, hostId, {
      kind: 'invite',
      targetId: m.id,
      expectedCredentialVersion: 1,
    });
    await prisma.room.update({ where: { id: roomId }, data: { capacity: 3 } });
    const newcomer = (await seedAdult(prisma)).id;
    const results = await Promise.allSettled([
      rooms.join(memberId, roomId, { rulesAccepted: true }),
      rooms.join(newcomer, roomId, { rulesAccepted: true }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await rooms.detail(hostId, roomId)).room.memberCount).toBe(3);
  });
  it('rolls back state, audit and command together when persistence fails', async () => {
    const m = await membership(memberId);
    const failing: RoomRealtimeRepository = new Proxy(repo, {
      get(target, key) {
        if (key === 'withRoom')
          return (id: string, op: Parameters<RoomRealtimeRepository['withRoom']>[1]) =>
            target.withRoom(id, (ctx) =>
              op({
                ...ctx,
                appendEvent: async () => {
                  throw new Error('injected storage failure');
                },
              }),
            );
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const service = new HostControlsService(failing, rooms, realtime);
    await expect(
      service.execute(roomId, hostId, {
        kind: 'remove',
        targetId: m.id,
        expectedCredentialVersion: 0,
      }),
    ).rejects.toThrow('injected');
    expect((await membership(memberId)).lifecycle).toBe('ACTIVE');
    expect((await room()).stateVersion).toBe(0);
    expect(await prisma.realtimeCommand.count()).toBe(0);
  });
  it('validates specified successors without fallback and transfers atomically', async () => {
    await connect(memberId);
    const third = await membership(thirdId);
    await expect(leave(hostId, third.id)).rejects.toMatchObject({ code: 'ROOM_SUCCESSOR_INVALID' });
    expect((await room()).hostUserId).toBe(hostId);
    await connect(thirdId);
    await leave(hostId, third.id);
    expect((await room()).hostUserId).toBe(thirdId);
    expect((await membership(hostId)).lifecycle).toBe('LEFT');
    expect(await prisma.roomMembership.count({ where: { roomId, role: 'HOST' } })).toBe(1);
    await expect(host.execute(roomId, hostId, { kind: 'end' })).rejects.toMatchObject({
      code: 'ROOM_HOST_REQUIRED',
    });
  });
  it('requires explicit online successor and closes when none remain', async () => {
    await connect(thirdId);
    await expect(leave(hostId)).rejects.toMatchObject({ code: 'ROOM_SUCCESSOR_INVALID' });
    await leave(hostId, (await membership(thirdId)).id);
    expect((await room()).hostUserId).toBe(thirdId);
    await leave(thirdId);
    expect((await room()).status).toBe('ENDING');
    await voice.dispatchPending(roomId);
    expect((await room()).status).toBe('ENDED');
  });
  it('retains pending cleanup on provider failure and completes recovery with old identities only', async () => {
    await voice.credentials(roomId, memberId);
    const m = await membership(memberId);
    provider.fail = true;
    await host.execute(roomId, hostId, {
      kind: 'remove',
      targetId: m.id,
      expectedCredentialVersion: 0,
    });
    await voice.dispatchPending(roomId);
    expect((await host.deliveryStatus(roomId)).providerStatus).toBe('UNAVAILABLE');
    expect((await membership(memberId)).lifecycle).toBe('REMOVED');
    provider.fail = false;
    await prisma.realtimeCommand.updateMany({ data: { nextAttemptAt: new Date(0) } });
    await voice.dispatchPending(roomId);
    expect((await host.deliveryStatus(roomId)).providerStatus).toBe('COMPLETED');
  });
  it('keeps ACTIVE sessions in a reconnect window but blocks new, LEFT and INVITED joins', async () => {
    const m = await membership(memberId);
    await host.execute(roomId, hostId, {
      kind: 'remove',
      targetId: m.id,
      expectedCredentialVersion: 0,
    });
    await host.execute(roomId, hostId, {
      kind: 'invite',
      targetId: m.id,
      expectedCredentialVersion: 1,
    });
    await leave(thirdId);
    await connect(hostId);
    await disconnect();
    const deadline = (await room()).hostReconnectDeadline!;
    expect(deadline.getTime()).toBeGreaterThan(Date.now() + 58_000);
    for (const id of [memberId, thirdId, (await seedAdult(prisma)).id])
      await expect(rooms.join(id, roomId, { rulesAccepted: true })).rejects.toMatchObject({
        code: 'ROOM_HOST_RECONNECTING',
        details: { retryAt: deadline.toISOString() },
      });
    await rooms.join(hostId, roomId, { rulesAccepted: false });
    await voice.credentials(roomId, hostId);
    expect((await rooms.detail(hostId, roomId)).room.memberCount).toBe(1);
  });
  it('restores at 59 seconds, ignores stale sessions and makes old timers harmless', async () => {
    await connect(hostId);
    await connect(memberId);
    await disconnect(new Date(Date.now() - 59_000));
    const timer = await prisma.realtimeCommand.findFirstOrThrow({
      where: { type: 'HOST_TIMEOUT' },
    });
    await connect(hostId, new Date());
    expect((await room()).hostReconnectDeadline).toBeNull();
    await realtime.hostTimeout(timer);
    expect((await room()).hostUserId).toBe(hostId);
    const h = await membership(hostId);
    await realtime.applySignal({
      id: randomUUID(),
      roomId,
      roomSid: 'RM_test',
      identity: h.participantIdentity,
      sessionSid: 'PA_older',
      type: 'left',
      occurredAt: new Date(),
    });
    expect((await room()).hostReconnectDeadline).toBeNull();
  });
  it('times out once despite unrelated state changes and cannot reclaim host with a late join', async () => {
    await connect(hostId);
    await connect(memberId);
    await disconnect(new Date(Date.now() - 59_000));
    const timer = await prisma.realtimeCommand.findFirstOrThrow({
      where: { type: 'HOST_TIMEOUT' },
    });
    await leave(thirdId);
    expect((await room()).hostReconnectVersion).toBe(timer.stateVersion);
    await prisma.room.update({
      where: { id: roomId },
      data: { hostReconnectDeadline: new Date(Date.now() - 1) },
    });
    await Promise.all([realtime.hostTimeout(timer), realtime.hostTimeout(timer)]);
    expect((await room()).hostUserId).toBe(memberId);
    await connect(hostId, new Date());
    expect((await room()).hostUserId).toBe(memberId);
    expect(await prisma.roomEvent.count({ where: { type: 'host_transferred' } })).toBe(1);
  });
  it('keeps an overdue unscheduled window closed to new joins and gives expiry priority', async () => {
    await connect(hostId);
    await connect(memberId);
    await disconnect();
    const timer = await prisma.realtimeCommand.findFirstOrThrow({
      where: { type: 'HOST_TIMEOUT' },
    });
    await prisma.room.update({
      where: { id: roomId },
      data: { hostReconnectDeadline: new Date(Date.now() - 1) },
    });
    await expect(
      rooms.join((await seedAdult(prisma)).id, roomId, { rulesAccepted: true }),
    ).rejects.toMatchObject({ code: 'ROOM_HOST_RECONNECTING' });
    await prisma.room.update({ where: { id: roomId }, data: { endsAt: new Date(Date.now() - 1) } });
    await realtime.hostTimeout(timer);
    expect((await room()).endedReason).toBe('EXPIRED');
    expect((await room()).hostReconnectDeadline).toBeNull();
    await expect(voice.credentials(roomId, hostId)).rejects.toMatchObject({ code: 'ROOM_ENDED' });
  });
  it('uses trusted observation to recover completely missing webhooks', async () => {
    const h = await membership(hostId),
      m = await membership(memberId);
    provider.connected = [
      { identity: h.participantIdentity, sessionSid: 'PA_h' },
      { identity: m.participantIdentity, sessionSid: 'PA_m' },
    ];
    await voice.reconcile(roomId);
    provider.connected = [{ identity: m.participantIdentity, sessionSid: 'PA_m' }];
    await voice.reconcile(roomId);
    expect((await room()).hostReconnectDeadline).not.toBeNull();
    provider.connected.push({ identity: h.participantIdentity, sessionSid: 'PA_h2' });
    await voice.reconcile(roomId);
    expect((await room()).hostReconnectDeadline).toBeNull();
    expect((await room()).hostUserId).toBe(hostId);
  });
  it('serializes host leave, candidate leave, removal and ending without duplicate hosts', async () => {
    await connect(memberId);
    await connect(thirdId);
    const m = await membership(memberId);
    await Promise.allSettled([
      leave(hostId, m.id),
      leave(memberId),
      host.execute(roomId, hostId, {
        kind: 'remove',
        targetId: m.id,
        expectedCredentialVersion: 0,
      }),
      host.execute(roomId, hostId, { kind: 'end' }),
    ]);
    const r = await room();
    if (r.status === 'OPEN')
      expect(
        await prisma.roomMembership.count({ where: { roomId, role: 'HOST', lifecycle: 'ACTIVE' } }),
      ).toBe(1);
    else
      await expect(
        rooms.join((await seedAdult(prisma)).id, roomId, { rulesAccepted: true }),
      ).rejects.toMatchObject({ code: 'ROOM_ENDED' });
  });
  it('host end is idempotent and blocks outstanding credential confirmation', async () => {
    const reservation = await realtime.reserveCredential(roomId, memberId);
    await host.execute(roomId, hostId, { kind: 'end' });
    await host.execute(roomId, hostId, { kind: 'end' });
    await expect(
      realtime.confirmCredential(reservation, memberId, 'RM_test'),
    ).rejects.toMatchObject({ code: 'ROOM_ENDED' });
    await realtime.finishCredential(reservation.issuanceId);
    await voice.dispatchPending(roomId);
    expect((await room()).status).toBe('ENDED');
    expect(provider.revoked).toContain(reservation.identity);
    expect(await prisma.roomEvent.count({ where: { type: 'room_ending' } })).toBe(1);
  });
  it('does not let unrelated credential issuance block removal and fences in-flight target credentials', async () => {
    await voice.credentials(roomId, memberId);
    const target = await realtime.reserveCredential(roomId, memberId);
    const other = await realtime.reserveCredential(roomId, thirdId);
    await host.execute(roomId, hostId, {
      kind: 'remove',
      targetId: (await membership(memberId)).id,
      expectedCredentialVersion: 0,
    });
    await expect(realtime.confirmCredential(target, memberId, 'RM_test')).rejects.toMatchObject({
      code: 'ROOM_MEMBERSHIP_REQUIRED',
    });
    await voice.dispatchPending(roomId);
    expect(provider.revoked).not.toContain(target.identity);
    await realtime.finishCredential(target.issuanceId);
    await voice.dispatchPending(roomId);
    expect(provider.revoked).toContain(target.identity);
    expect(
      await prisma.realtimeIssuance.findUnique({ where: { id: other.issuanceId } }),
    ).not.toBeNull();
  });
  it('ends on reconnect timeout when no online successor exists', async () => {
    await connect(hostId);
    await disconnect(new Date(Date.now() - 61_000));
    expect((await room()).status).toBe('ENDING');
    expect((await room()).endedReason).toBe('HOST_TIMEOUT_NO_SUCCESSOR');
    await voice.dispatchPending(roomId);
    expect((await room()).status).toBe('ENDED');
  });
  it.each([-1, 0])(
    'settles the exact reconnect boundary at deadline offset %s ms',
    async (offset) => {
      await connect(hostId);
      await connect(memberId);
      await disconnect();
      const before = await room();
      const now = new Date(before.hostReconnectDeadline!.getTime() + offset);
      const clocked: RoomRealtimeRepository = new Proxy(repo, {
        get(target, key) {
          if (key === 'withRoom')
            return (id: string, op: Parameters<RoomRealtimeRepository['withRoom']>[1]) =>
              target.withRoom(id, (ctx) => op({ ...ctx, now }));
          const value = Reflect.get(target, key);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      const service = new RoomRealtimeService(clocked, rooms);
      const h = await membership(hostId);
      await service.applySignal({
        id: randomUUID(),
        roomId,
        roomSid: 'RM_test',
        identity: h.participantIdentity,
        sessionSid: 'PA_reconnected',
        type: 'joined',
        occurredAt: now,
      });
      expect((await room()).hostUserId).toBe(offset < 0 ? hostId : memberId);
      expect((await room()).hostReconnectDeadline).toBeNull();
    },
  );
  it('rolls back a disconnect event and deadline if durable timeout insertion fails', async () => {
    await connect(hostId);
    const eventId = randomUUID(),
      h = await membership(hostId);
    const broken: RoomRealtimeRepository = new Proxy(repo, {
      get(target, key) {
        if (key === 'withRoom')
          return (id: string, op: Parameters<RoomRealtimeRepository['withRoom']>[1]) =>
            target.withRoom(id, (ctx) =>
              op({
                ...ctx,
                enqueue: async () => {
                  throw new Error('crash before commit');
                },
              }),
            );
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const signal = {
      id: eventId,
      roomId,
      roomSid: 'RM_test',
      identity: h.participantIdentity,
      sessionSid: h.providerSessionSid!,
      type: 'left' as const,
      occurredAt: new Date(),
    };
    await expect(new RoomRealtimeService(broken, rooms).applySignal(signal)).rejects.toThrow(
      'crash',
    );
    expect((await room()).hostReconnectDeadline).toBeNull();
    expect(await prisma.roomEvent.count({ where: { providerEventId: eventId } })).toBe(0);
    await realtime.applySignal(signal);
    expect((await room()).hostReconnectDeadline).not.toBeNull();
    expect(await prisma.realtimeCommand.count({ where: { type: 'HOST_TIMEOUT' } })).toBe(1);
  });
  it('reconstructs a lost timeout job on worker restart using real Redis and PostgreSQL', async () => {
    await connect(hostId);
    await connect(memberId);
    await disconnect();
    const timer = await prisma.realtimeCommand.findFirstOrThrow({
      where: { type: 'HOST_TIMEOUT' },
    });
    const config = new ConfigService<Environment, true>(realtimeEnvironment());
    const redis = new Redis(realtimeEnvironment().REDIS_URL!, { maxRetriesPerRequest: null });
    const raw = new Queue('slogan-realtime', { connection: redis });
    const queue = new RealtimeQueue(config, moduleRef.get(StructuredLogger));
    const runner = new RealtimeRunner(
      config,
      queue,
      realtime,
      voice,
      moduleRef.get(StructuredLogger),
    );
    try {
      await raw.obliterate({ force: true });
      await queue.start((job) => voice.dispatch(job.id));
      provider.connected = (
        await prisma.roomMembership.findMany({ where: { roomId, userId: memberId } })
      ).map((m) => ({ identity: m.participantIdentity, sessionSid: `PA_${m.id}` }));
      await runner.recover();
      expect((await raw.getJobs(['delayed'])).some((j) => j.data.kind === 'host-timeout')).toBe(
        true,
      );
      expect((await room()).hostUserId).toBe(hostId);
      await raw.obliterate({ force: true });
      await prisma.room.update({
        where: { id: roomId },
        data: { hostReconnectDeadline: new Date(Date.now() - 1) },
      });
      await prisma.realtimeCommand.update({
        where: { id: timer.id },
        data: { nextAttemptAt: new Date(0) },
      });
      await runner.recover();
      for (let i = 0; i < 50 && (await room()).hostUserId === hostId; i++)
        await new Promise((resolve) => setTimeout(resolve, 40));
      expect((await room()).hostUserId).toBe(memberId);
    } finally {
      await queue.onModuleDestroy();
      await raw.obliterate({ force: true });
      await raw.close();
      redis.disconnect();
    }
  });
});
