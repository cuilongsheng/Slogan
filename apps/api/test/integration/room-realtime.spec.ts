import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import type { Environment } from '../../src/config/environment.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import {
  RoomRealtimeService,
  RoomsService,
  ROOM_REALTIME_REPOSITORY,
  type RoomRealtimeRepository,
} from '../../src/modules/rooms/index.js';
import { RealtimeQueue } from '../../src/infrastructure/redis/realtime-queue.service.js';
import { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { RealtimeRunner, VoiceService } from '../../src/modules/voice/testing.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import {
  seedAdult,
  clearRealtimeFixtures,
  FakeRealtimeProvider,
  realtimeEnvironment,
} from '../fixtures/realtime.js';

describe('realtime PostgreSQL state and recovery', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let rooms: RoomsService;
  let realtime: RoomRealtimeService;
  let repository: RoomRealtimeRepository;
  let provider: FakeRealtimeProvider;
  let voice: VoiceService;
  let roomId: string;
  let hostId: string;
  let memberId: string;
  beforeAll(async () => {
    installTestEnvironment();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    rooms = moduleRef.get(RoomsService);
    realtime = moduleRef.get(RoomRealtimeService);
    repository = moduleRef.get(ROOM_REALTIME_REPOSITORY);
    await prisma.$connect();
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    hostId = (await seedAdult(prisma, 'Host')).id;
    memberId = (await seedAdult(prisma, 'Member')).id;
    roomId = (await rooms.create(hostId, { topic: 'Realtime tests', cefrLevel: 'B1', capacity: 4 }))
      .room.id;
    await rooms.join(memberId, roomId, { rulesAccepted: true });
    provider = new FakeRealtimeProvider();
    voice = new VoiceService(
      realtime,
      provider,
      new ConfigService<Environment, true>(realtimeEnvironment()),
    );
  });
  afterAll(async () => moduleRef.close());
  async function issued() {
    return realtime.reserveCredential(roomId, hostId);
  }
  async function ready() {
    const token = await issued();
    await realtime.confirmCredential(token, hostId, 'RM_test');
    return token;
  }
  async function releaseIssuance() {
    await prisma.realtimeIssuance.deleteMany();
  }
  it('rejects non-members and disabled accounts without recording a credential', async () => {
    const stranger = await seedAdult(prisma);
    await expect(realtime.reserveCredential(roomId, stranger.id)).rejects.toMatchObject({
      code: 'ROOM_MEMBERSHIP_REQUIRED',
    });
    await prisma.user.update({ where: { id: hostId }, data: { status: 'DISABLED' } });
    await expect(realtime.reserveCredential(roomId, hostId)).rejects.toBeDefined();
    expect(await prisma.realtimeIdentity.count()).toBe(0);
  });
  it('retains identity history, projects only necessary member fields, and keeps disconnected capacity', async () => {
    const reservation = await ready();
    const members = await realtime.members(roomId, hostId);
    expect(members.map((m) => m.position)).toEqual([1, 2]);
    expect(members[0]).toMatchObject({
      participantIdentity: reservation.identity,
      presence: 'DISCONNECTED',
      role: 'HOST',
    });
    expect(members[0]).toHaveProperty('userId', hostId);
    expect(members[0]).not.toHaveProperty('providerSessionSid');
    expect((await rooms.detail(hostId, roomId)).room.memberCount).toBe(2);
    expect(await prisma.realtimeIdentity.count()).toBe(1);
  });
  it('deduplicates webhook events and prevents an old session disconnect from overriding a new session', async () => {
    const reservation = await ready();
    const now = Date.now() - 5000;
    const event = {
      id: randomUUID(),
      roomId,
      roomSid: 'RM_test',
      type: 'joined' as const,
      identity: reservation.identity,
      sessionSid: 'PA_new',
      occurredAt: new Date(now),
    };
    expect(await realtime.applySignal(event)).toBe(true);
    expect(await realtime.applySignal(event)).toBe(false);
    expect(
      await realtime.applySignal({
        ...event,
        id: randomUUID(),
        type: 'left',
        sessionSid: 'PA_old',
        occurredAt: new Date(now + 1000),
      }),
    ).toBe(false);
    expect(
      await realtime.applySignal({
        ...event,
        id: randomUUID(),
        type: 'left',
        occurredAt: new Date(now - 1000),
      }),
    ).toBe(false);
    expect((await realtime.members(roomId, hostId))[0]?.presence).toBe('CONNECTED');
    expect(await prisma.roomEvent.count({ where: { providerEventId: event.id } })).toBe(1);
  });
  it('rejects old room instances and unauthorized identities without creating memberships', async () => {
    const reservation = await ready();
    await realtime.applySignal({
      id: randomUUID(),
      roomId,
      roomSid: 'RM_old',
      type: 'finished',
      occurredAt: new Date(),
    });
    await realtime.applySignal({
      id: randomUUID(),
      roomId,
      roomSid: 'RM_test',
      type: 'joined',
      identity: randomUUID(),
      sessionSid: 'PA_unknown',
      occurredAt: new Date(),
    });
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('OPEN');
    expect(await prisma.roomMembership.count()).toBe(2);
    expect(
      (await prisma.roomMembership.findUniqueOrThrow({ where: { id: reservation.membershipId } }))
        .presence,
    ).toBe('DISCONNECTED');
  });
  it('closes authorization before provider cleanup and rejects a credential issuance racing with ending', async () => {
    const reservation = await issued();
    await realtime.endRoom(roomId, 'TEST_END');
    await expect(realtime.confirmCredential(reservation, hostId, 'RM_test')).rejects.toMatchObject({
      code: 'ROOM_ENDED',
    });
    await expect(rooms.join(memberId, roomId, { rulesAccepted: true })).rejects.toMatchObject({
      code: 'ROOM_ENDED',
    });
    await expect(realtime.reserveCredential(roomId, hostId)).rejects.toMatchObject({
      code: 'ROOM_ENDED',
    });
    expect(await prisma.realtimeCommand.count()).toBe(2);
    for (const id of await realtime.pendingCommands())
      expect(await realtime.claimCommand(id)).toBeNull();
  });
  it('serializes repeated endings, revokes every identity before delete, and completes only once', async () => {
    const first = await ready();
    const second = await realtime.reserveCredential(roomId, memberId);
    await Promise.all([realtime.endRoom(roomId, 'EXPIRED'), realtime.endRoom(roomId, 'EXPIRED')]);
    await releaseIssuance();
    await voice.dispatchPending();
    await voice.dispatchPending();
    expect(provider.revoked.sort()).toEqual([first.identity, second.identity].sort());
    expect(provider.deleted).toEqual([roomId]);
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('ENDED');
    expect(await prisma.realtimeCommand.count()).toBe(3);
  });
  it('persists provider failure and recovers a leased command without accepting stale completion', async () => {
    await ready();
    await realtime.endRoom(roomId, 'EXPIRED');
    await releaseIssuance();
    const command = await prisma.realtimeCommand.findFirstOrThrow({
      where: { type: 'REVOKE_IDENTITY' },
    });
    const first = await realtime.claimCommand(command.id);
    expect(first).not.toBeNull();
    expect(await realtime.claimCommand(command.id)).toBeNull();
    await prisma.realtimeCommand.update({
      where: { id: command.id },
      data: { lockedUntil: new Date(0) },
    });
    const second = await realtime.claimCommand(command.id);
    expect(second?.leaseId).not.toBe(first?.leaseId);
    await realtime.completeCommand(first!);
    expect(
      (await prisma.realtimeCommand.findUniqueOrThrow({ where: { id: command.id } })).status,
    ).toBe('RUNNING');
    await realtime.failCommand(second!);
    expect(
      (await prisma.realtimeCommand.findUniqueOrThrow({ where: { id: command.id } })).status,
    ).toBe('PENDING');
    await prisma.realtimeCommand.update({
      where: { id: command.id },
      data: { nextAttemptAt: new Date(0) },
    });
    provider.fail = true;
    await expect(voice.dispatch(command.id)).rejects.toMatchObject({
      code: 'REALTIME_PROVIDER_UNAVAILABLE',
    });
    expect(provider.deleted).toHaveLength(0);
    provider.fail = false;
    await prisma.realtimeCommand.update({
      where: { id: command.id },
      data: { nextAttemptAt: new Date(0) },
    });
    await voice.dispatchPending();
    await voice.dispatchPending();
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('ENDED');
  });
  it('rolls back business state, audit and outbox together', async () => {
    await expect(
      repository.withRoom(roomId, async (ctx) => {
        await ctx.saveRoom({ status: 'ENDING' });
        await ctx.appendEvent({
          type: 'test',
          source: 'server',
          result: 'PENDING',
          occurredAt: ctx.now,
        });
        await ctx.enqueue('DELETE_ROOM');
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await prisma.roomEvent.count()).toBe(0);
    expect(await prisma.realtimeCommand.count()).toBe(0);
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('OPEN');
  });
  it('uses database expiry and recovers completely lost presence webhooks', async () => {
    const reservation = await ready();
    await voice.expire(roomId);
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('OPEN');
    provider.connected = [{ identity: reservation.identity, sessionSid: 'PA_reconciled' }];
    await voice.reconcile(roomId);
    expect((await realtime.members(roomId, hostId))[0]?.presence).toBe('CONNECTED');
    provider.connected = [];
    await voice.reconcile(roomId);
    expect((await realtime.members(roomId, hostId))[0]?.presence).toBe('DISCONNECTED');
    await prisma.room.update({ where: { id: roomId }, data: { endsAt: new Date(Date.now() - 1) } });
    await voice.expire(roomId);
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('ENDING');
  });
  it('preserves disconnect precedence for equal-second events from the same provider session', async () => {
    const reservation = await ready();
    const occurredAt = new Date(Math.floor(Date.now() / 1000) * 1000 - 1000);
    const signal = {
      id: randomUUID(),
      roomId,
      roomSid: 'RM_test',
      type: 'joined' as const,
      identity: reservation.identity,
      sessionSid: 'PA_same',
      occurredAt,
    };
    await realtime.applySignal(signal);
    expect(await realtime.applySignal({ ...signal, id: randomUUID(), type: 'left' })).toBe(true);
    expect(await realtime.applySignal({ ...signal, id: randomUUID() })).toBe(false);
    expect((await realtime.members(roomId, hostId))[0]?.presence).toBe('DISCONNECTED');
  });
  it('records unknown rooms minimally and deduplicates ignored provider events', async () => {
    const signal = {
      id: randomUUID(),
      roomId: randomUUID(),
      roomSid: 'RM_unknown',
      type: 'finished' as const,
      occurredAt: new Date(),
    };
    await realtime.applySignal(signal);
    await realtime.applySignal(signal);
    const events = await prisma.roomEvent.findMany({ where: { providerEventId: signal.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ roomId: null, reason: 'UNKNOWN_ROOM', result: 'IGNORED' });
  });
  it('leaves exhausted commands observable and prevents room deletion while revocation failed', async () => {
    await ready();
    await realtime.endRoom(roomId, 'EXPIRED');
    await releaseIssuance();
    const command = await prisma.realtimeCommand.findFirstOrThrow({
      where: { type: 'REVOKE_IDENTITY' },
    });
    await prisma.realtimeCommand.update({ where: { id: command.id }, data: { attempts: 7 } });
    provider.fail = true;
    await expect(voice.dispatch(command.id)).rejects.toBeDefined();
    expect(
      (await prisma.realtimeCommand.findUniqueOrThrow({ where: { id: command.id } })).status,
    ).toBe('FAILED');
    provider.fail = false;
    await voice.dispatchPending();
    expect(provider.deleted).toHaveLength(0);
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('ENDING');
  });
  it('reconstructs expiry jobs from PostgreSQL when Redis jobs are lost', async () => {
    const config = new ConfigService<Environment, true>(realtimeEnvironment());
    const connection = new Redis(realtimeEnvironment().REDIS_URL!, { maxRetriesPerRequest: null });
    const inspect = new Queue('slogan-realtime', { connection });
    const queue = new RealtimeQueue(config, new StructuredLogger());
    const runner = new RealtimeRunner(config, queue, realtime, voice, new StructuredLogger());
    try {
      await inspect.obliterate({ force: true });
      await queue.start(async (job) => {
        if (job.kind === 'expiry') await voice.expire(job.id);
        else await voice.dispatch(job.id);
      });
      const deadline = Date.now() + 5000;
      while ((await inspect.getDelayedCount()) === 0 && Date.now() < deadline) {
        await runner.recover();
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(await inspect.getDelayedCount()).toBe(1);
      await inspect.obliterate({ force: true });
      expect(await inspect.getDelayedCount()).toBe(0);
      await runner.recover();
      expect(await inspect.getDelayedCount()).toBe(1);
      expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('OPEN');
    } finally {
      await queue.onModuleDestroy();
      await inspect.obliterate({ force: true });
      await inspect.close();
      connection.disconnect();
    }
  });
  it('releases successful issuance immediately without imposing a cleanup grace period', async () => {
    await voice.credentials(roomId, hostId);
    expect(await prisma.realtimeIssuance.count()).toBe(0);
    await realtime.endRoom(roomId, 'TEST_END');
    await voice.dispatchPending();
    await voice.dispatchPending();
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('ENDED');
  });
  it('keeps independent concurrent issuance leases and recovers crashed issuers after their deadline', async () => {
    const [first, second] = await Promise.all([issued(), issued()]);
    await realtime.finishCredential(first.issuanceId);
    await realtime.finishCredential(first.issuanceId);
    expect(await prisma.realtimeIssuance.count()).toBe(1);
    expect(
      await prisma.realtimeIssuance.findUnique({ where: { id: second.issuanceId } }),
    ).not.toBeNull();
    await realtime.endRoom(roomId, 'TEST_END');
    await voice.dispatchPending();
    expect(provider.deleted).toHaveLength(0);
    await prisma.realtimeIssuance.updateMany({ data: { expiresAt: new Date(0) } });
    await voice.dispatchPending();
    await voice.dispatchPending();
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('ENDED');
  });
});
