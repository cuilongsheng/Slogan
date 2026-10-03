import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type { Environment } from '../../src/config/environment.js';
import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import {
  RoomsService,
  RoomRealtimeService,
  HostControlsService,
} from '../../src/modules/rooms/index.js';
import { AppointmentsService } from '../../src/modules/rooms/testing.js';
import { VoiceService, RealtimeRunner } from '../../src/modules/voice/testing.js';
import { RealtimeQueue } from '../../src/infrastructure/redis/realtime-queue.service.js';
import { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { installTestEnvironment, testEnvironment } from '../fixtures/environment.js';
import {
  clearRealtimeFixtures,
  seedAdult,
  FakeRealtimeProvider,
  realtimeEnvironment,
} from '../fixtures/realtime.js';

describe('appointment transactions and lifecycle', () => {
  let ref: TestingModule,
    prisma: PrismaService,
    appointments: AppointmentsService,
    rooms: RoomsService,
    realtime: RoomRealtimeService,
    controls: HostControlsService;
  let owner: string, member: string, third: string, id: string;
  beforeAll(async () => {
    installTestEnvironment();
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = ref.get(PrismaService);
    appointments = ref.get(AppointmentsService);
    rooms = ref.get(RoomsService);
    realtime = ref.get(RoomRealtimeService);
    controls = ref.get(HostControlsService);
    await prisma.$connect();
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    owner = (await seedAdult(prisma, 'Owner')).id;
    member = (await seedAdult(prisma, 'Member')).id;
    third = (await seedAdult(prisma, 'Third')).id;
    id = (
      await appointments.create(owner, {
        topic: 'Planned conversation',
        cefrLevel: 'B1',
        capacity: 2,
        startsAt: new Date(Date.now() + 600_000).toISOString(),
        endsAt: new Date(Date.now() + 3600_000).toISOString(),
      })
    ).id;
  });
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await ref.close();
  });
  const book = (userId = member, version = 0) =>
    appointments.reserve(userId, id, { rulesAccepted: true, expectedReservationVersion: version });
  const room = () => prisma.room.findUniqueOrThrow({ where: { id } });
  const membership = (userId: string) =>
    prisma.roomMembership.findUniqueOrThrow({ where: { roomId_userId: { roomId: id, userId } } });
  async function clock(age: number) {
    const start = new Date(Date.now() - age);
    await prisma.room.update({
      where: { id },
      data: { startedAt: start, initialHostDeadline: new Date(start.getTime() + 300_000) },
    });
  }
  async function connect(userId: string) {
    await prisma.room.update({ where: { id }, data: { providerRoomSid: 'RM_test' } });
    const m = await membership(userId);
    await realtime.applySignal({
      id: randomUUID(),
      roomId: id,
      roomSid: 'RM_test',
      identity: m.participantIdentity,
      sessionSid: `PA_${m.id}`,
      type: 'joined',
      occurredAt: new Date(),
    });
  }
  it('creates a reserved owner without membership and excludes appointments from instant discovery', async () => {
    expect(await appointments.detail(owner, id)).toMatchObject({
      status: 'SCHEDULED',
      memberCount: 0,
      reservedCount: 1,
      availableCount: 1,
    });
    expect(await prisma.roomMembership.count()).toBe(0);
    expect((await rooms.list(owner, {})).items).toHaveLength(0);
    await expect(rooms.join(owner, id, { rulesAccepted: true })).rejects.toMatchObject({
      code: 'ROOM_NOT_STARTED',
    });
    await expect(realtime.reserveCredential(id, owner)).rejects.toBeDefined();
  });
  it('serializes last-seat reservations and replays cancellation without deleting a newer booking', async () => {
    const results = await Promise.allSettled([book(member), book(third)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const winner = (await appointments.detail(member, id)).reservation ? member : third;
    expect(await book(winner)).toMatchObject({ version: 1 });
    await appointments.cancelReservation(winner, id, 1);
    await book(winner, 2);
    await expect(appointments.cancelReservation(winner, id, 1)).rejects.toMatchObject({
      code: 'RESERVATION_CONFLICT',
    });
    expect((await appointments.detail(owner, id)).reservedCount).toBe(2);
  });
  it('protects booked seats, atomically consumes them, and keeps failed joins unconsumed', async () => {
    await book();
    await clock(10_000);
    await expect(rooms.join(third, id, { rulesAccepted: true })).rejects.toMatchObject({
      code: 'ROOM_RESERVED',
    });
    await expect(rooms.join(member, id, { rulesAccepted: false })).rejects.toMatchObject({
      code: 'ROOM_RULES_NOT_ACCEPTED',
    });
    expect((await appointments.detail(member, id)).reservation?.status).toBe('BOOKED');
    await rooms.join(member, id, { rulesAccepted: true });
    expect(await appointments.detail(member, id)).toMatchObject({
      memberCount: 1,
      reservedCount: 1,
      availableCount: 0,
      reservation: { status: 'CONSUMED' },
    });
    await rooms.join(member, id, { rulesAccepted: true });
    expect(await prisma.roomMembership.count()).toBe(1);
  });
  it('rejects owner-seat cancellation and cancels a scheduled room idempotently', async () => {
    await expect(appointments.cancelReservation(owner, id, 1)).rejects.toMatchObject({
      code: 'RESERVATION_OWNER_REQUIRED',
    });
    await expect(appointments.cancelRoom(member, id)).rejects.toMatchObject({
      code: 'ROOM_HOST_REQUIRED',
    });
    await appointments.cancelRoom(owner, id);
    await appointments.cancelRoom(owner, id);
    await clock(400_000);
    await realtime.settleAppointment(id);
    expect((await room()).status).toBe('CANCELLED');
    await expect(rooms.join(owner, id, { rulesAccepted: true })).rejects.toMatchObject({
      code: 'ROOM_CANCELLED',
    });
    expect(await prisma.realtimeCommand.count()).toBe(0);
  });
  it('does not wait when the five-minute window closes on an empty room', async () => {
    await clock(301_000);
    await expect(rooms.join(owner, id, { rulesAccepted: true })).rejects.toMatchObject({
      code: 'ROOM_ENDED',
    });
    expect(await room()).toMatchObject({
      status: 'ENDED',
      endedReason: 'EMPTY_AFTER_START_WINDOW',
    });
    expect(await prisma.realtimeCommand.count()).toBe(0);
    expect(await prisma.roomReservation.count({ where: { status: 'BOOKED' } })).toBe(0);
  });
  it('transfers to the earliest online member without a previous host membership; late owner is ordinary', async () => {
    await book();
    await clock(10_000);
    await rooms.join(member, id, { rulesAccepted: true });
    await connect(member);
    await clock(301_000);
    await realtime.settleAppointment(id);
    expect((await room()).hostUserId).toBe(member);
    expect((await membership(member)).role).toBe('HOST');
    expect((await rooms.join(owner, id, { rulesAccepted: true })).currentMembership?.role).toBe(
      'MEMBER',
    );
    await connect(owner);
    expect((await room()).hostUserId).toBe(member);
  });
  it('keeps empty rooms before five minutes but ends after the last ordinary member leaves later', async () => {
    await book();
    await clock(10_000);
    await rooms.join(member, id, { rulesAccepted: true });
    await connect(member);
    await controls.execute(id, member, { kind: 'leave', expectedCredentialVersion: 0 });
    expect((await room()).status).toBe('OPEN');
    await rooms.join(member, id, { rulesAccepted: true });
    await connect(member);
    // Owner arrived once, then is offline: the member still has an ordinary role.
    await prisma.room.update({ where: { id }, data: { initialHostResolved: true } });
    await clock(301_000);
    await controls.execute(id, member, {
      kind: 'leave',
      expectedCredentialVersion: (await membership(member)).credentialVersion,
    });
    expect(await room()).toMatchObject({
      status: 'ENDING',
      endedReason: 'EMPTY_AFTER_START_WINDOW',
    });
  });
  it('does not start the 60-second host window for an initial connection abort', async () => {
    await clock(10_000);
    await rooms.join(owner, id, { rulesAccepted: true });
    await prisma.room.update({ where: { id }, data: { providerRoomSid: 'RM_test' } });
    const m = await membership(owner);
    await realtime.applySignal({
      id: randomUUID(),
      roomId: id,
      roomSid: 'RM_test',
      identity: m.participantIdentity,
      type: 'aborted',
      occurredAt: new Date(),
    });
    expect((await room()).hostReconnectDeadline).toBeNull();
  });
  it('ends immediately when an arrived host disconnects after five minutes and keeps provider failures pending', async () => {
    await clock(10_000);
    await rooms.join(owner, id, { rulesAccepted: true });
    const provider = new FakeRealtimeProvider();
    const voice = new VoiceService(
      realtime,
      provider,
      new ConfigService<Environment, true>(realtimeEnvironment()),
    );
    await voice.credentials(id, owner);
    await connect(owner);
    await clock(301_000);
    const m = await membership(owner);
    await realtime.applySignal({
      id: randomUUID(),
      roomId: id,
      roomSid: 'RM_test',
      identity: m.participantIdentity,
      sessionSid: `PA_${m.id}`,
      type: 'left',
      occurredAt: new Date(),
    });
    expect(await room()).toMatchObject({
      status: 'ENDING',
      hostReconnectDeadline: null,
      endedReason: 'EMPTY_AFTER_START_WINDOW',
    });
    provider.fail = true;
    await voice.dispatchPending(id);
    expect((await room()).status).toBe('ENDING');
    await expect(voice.credentials(id, owner)).rejects.toBeDefined();
    await connect(owner);
    expect((await room()).status).toBe('ENDING');
  });
  it('recovers overdue rooms with realtime disabled and no Redis, never opening an expired appointment', async () => {
    const startedAt = new Date(Date.now() - 600_000);
    await prisma.room.update({
      where: { id },
      data: {
        startedAt,
        initialHostDeadline: new Date(startedAt.getTime() + 300_000),
        endsAt: new Date(Date.now() - 10_000),
      },
    });
    const config = new ConfigService<Environment, true>(testEnvironment());
    const runner = new RealtimeRunner(
      config,
      ref.get(RealtimeQueue),
      realtime,
      ref.get(VoiceService),
      ref.get(StructuredLogger),
    );
    await runner.recover();
    await runner.recover();
    expect(await room()).toMatchObject({ status: 'ENDED', endedReason: 'EXPIRED' });
    expect(await prisma.roomEvent.count({ where: { type: 'appointment_opened' } })).toBe(0);
  });
  it('rebuilds appointment jobs after Redis task loss while realtime is disabled', async () => {
    const config = new ConfigService<Environment, true>(
      testEnvironment({ REDIS_URL: 'redis://127.0.0.1:56379/14' }),
    );
    const redis = new Redis('redis://127.0.0.1:56379/14', { maxRetriesPerRequest: null });
    const raw = new Queue('slogan-realtime', { connection: redis });
    const queue = new RealtimeQueue(config, ref.get(StructuredLogger));
    const runner = new RealtimeRunner(
      config,
      queue,
      realtime,
      ref.get(VoiceService),
      ref.get(StructuredLogger),
    );
    try {
      await raw.obliterate({ force: true });
      await queue.start(async (job) => {
        await realtime.settleAppointment(job.id);
      });
      await runner.recover();
      expect((await raw.getJobs(['delayed'])).map((j) => j.data.kind).sort()).toEqual([
        'appointment-open',
        'appointment-start-window',
      ]);
      await raw.obliterate({ force: true });
      await runner.recover();
      expect(await raw.getDelayedCount()).toBe(2);
      await clock(301_000);
      await runner.recover();
      expect((await room()).status).toBe('ENDED');
    } finally {
      await queue.onModuleDestroy();
      await raw.obliterate({ force: true });
      await raw.close();
      redis.disconnect();
    }
  });
  it('rolls back actual membership creation when reservation consumption fails', async () => {
    await book();
    await clock(10_000);
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION test_appointment_consume_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected reservation write failure'; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER test_appointment_consume_failure BEFORE UPDATE ON "RoomReservation" FOR EACH ROW WHEN (NEW.status = 'CONSUMED') EXECUTE FUNCTION test_appointment_consume_failure()`,
    );
    try {
      await expect(rooms.join(member, id, { rulesAccepted: true })).rejects.toThrow(
        'injected reservation write failure',
      );
      expect(await prisma.roomMembership.count({ where: { roomId: id } })).toBe(0);
      expect((await appointments.detail(member, id)).reservation?.status).toBe('BOOKED');
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER test_appointment_consume_failure ON "RoomReservation"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION test_appointment_consume_failure()');
    }
  });
});
