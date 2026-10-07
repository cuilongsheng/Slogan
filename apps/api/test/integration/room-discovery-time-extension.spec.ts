import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AppointmentsService } from '../../src/modules/rooms/testing.js';
import { RoomRealtimeService, RoomsService } from '../../src/modules/rooms/index.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';
import { FakeRealtimeProvider, realtimeEnvironment } from '../fixtures/realtime.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { VoiceService } from '../../src/modules/voice/testing.js';
import type { Environment } from '../../src/config/environment.js';

describe('room discovery, sharing and extension persistence', () => {
  let ref: TestingModule;
  let prisma: PrismaService;
  let rooms: RoomsService;
  let appointments: AppointmentsService;
  let realtime: RoomRealtimeService;
  let hostId: string;
  let memberId: string;

  beforeAll(async () => {
    installTestEnvironment();
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = ref.get(PrismaService);
    rooms = ref.get(RoomsService);
    appointments = ref.get(AppointmentsService);
    realtime = ref.get(RoomRealtimeService);
    await prisma.$connect();
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    hostId = (await seedAdult(prisma, 'Discovery Host')).id;
    memberId = (await seedAdult(prisma, 'Discovery Member')).id;
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await ref.close();
  });

  it('defaults to PUBLIC, excludes LINK_ONLY, filters both fields and rejects cursor reuse', async () => {
    const first = await rooms.create(hostId, {
      topic: 'Backend Conversation',
      cefrLevel: 'B1',
      capacity: 4,
    });
    const hidden = await rooms.create(hostId, {
      topic: 'Backend private',
      cefrLevel: 'B1',
      capacity: 4,
      visibility: 'LINK_ONLY',
    });
    await rooms.create(hostId, { topic: 'Frontend talk', cefrLevel: 'B2', capacity: 4 });

    expect(first.room.visibility).toBe('PUBLIC');
    expect(hidden.room.shareCode).not.toBe(hidden.room.id);
    const page = await rooms.list(hostId, { cefrLevel: 'B1', topic: '  BACKEND  ', limit: 1 });
    expect(page.items.map((room) => room.id)).toEqual([first.room.id]);
    expect(page.items).not.toContainEqual(expect.objectContaining({ id: hidden.room.id }));

    const unfiltered = await rooms.list(hostId, { limit: 1 });
    expect(unfiltered.nextCursor).not.toBeNull();
    await expect(
      rooms.list(hostId, { limit: 1, cursor: unfiltered.nextCursor!, cefrLevel: 'B1' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('applies the same discovery and stable share rules to appointments', async () => {
    const startsAt = new Date(Date.now() + 600_000).toISOString();
    const endsAt = new Date(Date.now() + 3_600_000).toISOString();
    const visible = await appointments.create(hostId, {
      topic: 'Travel English',
      cefrLevel: 'A2',
      capacity: 3,
      startsAt,
      endsAt,
    });
    await appointments.create(hostId, {
      topic: 'Travel hidden',
      cefrLevel: 'A2',
      capacity: 3,
      startsAt,
      endsAt,
      visibility: 'LINK_ONLY',
    });
    const page = await appointments.list(hostId, { cefrLevel: 'A2', topic: ' travel ' });
    expect(page.items.map((room) => room.id)).toEqual([visible.id]);
    expect((await appointments.detail(hostId, visible.id)).shareUrl).toBe(visible.shareUrl);
  });

  it('returns only the minimum share projection and makes ended links unavailable', async () => {
    const created = await rooms.create(hostId, {
      topic: 'Shared room',
      cefrLevel: 'C1',
      capacity: 4,
      password: '1234',
      visibility: 'LINK_ONLY',
    });
    const projection = await rooms.resolveShare(created.room.shareCode);
    const repeated = await rooms.resolveShare(created.room.shareCode, projection.attributionId);
    expect(repeated.attributionId).toBe(projection.attributionId);
    expect(await prisma.roomShareAttribution.count({ where: { roomId: created.room.id } })).toBe(1);
    expect(Object.keys(projection).sort()).toEqual(
      [
        'availableCount',
        'attributionId',
        'capacity',
        'cefrLevel',
        'cefrLevelMin',
        'cefrLevelMax',
        'endsAt',
        'hostDisplayName',
        'id',
        'kind',
        'memberCount',
        'passwordProtected',
        'postRoomKeywordsEnabled',
        'reservedCount',
        'sensitiveSpeechDetectionEnabled',
        'startedAt',
        'status',
        'topic',
        'visibility',
      ].sort(),
    );
    await rooms.join(memberId, created.room.id, {
      rulesAccepted: true,
      password: '1234',
      shareAttributionId: projection.attributionId,
    });
    expect(
      await prisma.roomShareAttribution.count({
        where: { id: projection.attributionId, joinedAt: { not: null } },
      }),
    ).toBe(1);
    await prisma.room.update({ where: { id: created.room.id }, data: { status: 'ENDED' } });
    await expect(rooms.resolveShare(created.room.shareCode)).rejects.toMatchObject({
      code: 'ROOM_SHARE_UNAVAILABLE',
    });
  });

  it('commits extension facts, event and sync command exactly once', async () => {
    const created = await rooms.create(hostId, {
      topic: 'Extend safely',
      cefrLevel: 'B1',
      capacity: 4,
    });
    const requestId = randomUUID();
    const first = await rooms.extend(hostId, created.room.id, {
      clientRequestId: requestId,
      additionalMinutes: 30,
    });
    const replay = await rooms.extend(hostId, created.room.id, {
      clientRequestId: requestId,
      additionalMinutes: 30,
    });
    expect(replay).toEqual(first);
    expect(first.endsAt.getTime() - first.previousEndsAt.getTime()).toBe(1_800_000);
    expect(await prisma.roomTimeExtension.count({ where: { roomId: created.room.id } })).toBe(1);
    expect(
      await prisma.roomEvent.count({
        where: { roomId: created.room.id, type: 'room_time_extended' },
      }),
    ).toBe(1);
    expect(
      await prisma.realtimeCommand.count({
        where: { roomId: created.room.id, type: 'SYNC_ROOM_TIME' },
      }),
    ).toBe(1);
    await expect(
      rooms.extend(hostId, created.room.id, {
        clientRequestId: requestId,
        additionalMinutes: 31,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_EXTENSION_REQUEST_CONFLICT' });
    await expect(
      rooms.extend(memberId, created.room.id, {
        clientRequestId: randomUUID(),
        additionalMinutes: 1,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_HOST_REQUIRED' });
  });

  it('serializes contenders for the third extension and ignores an old expiry task', async () => {
    const created = await rooms.create(hostId, {
      topic: 'Final extension',
      cefrLevel: 'B2',
      capacity: 4,
    });
    await prisma.room.update({
      where: { id: created.room.id },
      data: { extensionCount: 2, endsAt: new Date(Date.now() + 60_000) },
    });
    const contenders = await Promise.allSettled(
      [1, 2].map((additionalMinutes) =>
        rooms.extend(hostId, created.room.id, {
          clientRequestId: randomUUID(),
          additionalMinutes,
        }),
      ),
    );
    expect(contenders.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(contenders.filter((result) => result.status === 'rejected')).toMatchObject([
      { reason: { code: 'ROOM_EXTENSION_LIMIT' } },
    ]);
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: created.room.id } })).extensionCount,
    ).toBe(3);
    await expect(realtime.endRoom(created.room.id, 'EXPIRED', true)).resolves.toBe(false);
    expect((await prisma.room.findUniqueOrThrow({ where: { id: created.room.id } })).status).toBe(
      'OPEN',
    );
  });

  it('extends an appointment only after database lifecycle settlement opens it', async () => {
    const created = await appointments.create(hostId, {
      topic: 'Open appointment',
      cefrLevel: 'B1',
      capacity: 3,
      startsAt: new Date(Date.now() + 600_000).toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await expect(
      rooms.extend(hostId, created.id, { clientRequestId: randomUUID(), additionalMinutes: 5 }),
    ).rejects.toMatchObject({ code: 'ROOM_EXTENSION_NOT_AVAILABLE' });
    const startedAt = new Date(Date.now() - 1_000);
    await prisma.room.update({
      where: { id: created.id },
      data: { startedAt, initialHostDeadline: new Date(startedAt.getTime() + 300_000) },
    });
    await expect(
      rooms.extend(hostId, created.id, { clientRequestId: randomUUID(), additionalMinutes: 5 }),
    ).resolves.toMatchObject({ extensionCount: 1 });
  });

  it('keeps provider failure recoverable and converges metadata to a newer concurrent extension', async () => {
    const created = await rooms.create(hostId, {
      topic: 'Metadata recovery',
      cefrLevel: 'B1',
      capacity: 4,
    });
    await prisma.room.update({
      where: { id: created.room.id },
      data: { providerRoomSid: 'RM_test' },
    });
    const provider = new FakeRealtimeProvider();
    const voice = new VoiceService(
      realtime,
      provider,
      new ConfigService<Environment, true>(realtimeEnvironment()),
    );
    await rooms.extend(hostId, created.room.id, {
      clientRequestId: randomUUID(),
      additionalMinutes: 5,
    });
    await expect(realtime.operationStatus(created.room.id)).resolves.toMatchObject({
      providerStatus: 'PENDING',
    });
    provider.fail = true;
    await voice.dispatchPending(created.room.id);
    await expect(realtime.operationStatus(created.room.id)).resolves.toMatchObject({
      providerStatus: 'UNAVAILABLE',
    });
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: created.room.id } })).extensionCount,
    ).toBe(1);

    provider.fail = false;
    await prisma.realtimeCommand.updateMany({
      where: { roomId: created.room.id, status: 'PENDING' },
      data: { nextAttemptAt: new Date(0) },
    });
    let extendedAgain = false;
    const update = provider.updateRoomMetadata.bind(provider);
    provider.updateRoomMetadata = async (roomId, metadata) => {
      const result = await update(roomId, metadata);
      if (!extendedAgain) {
        extendedAgain = true;
        await rooms.extend(hostId, created.room.id, {
          clientRequestId: randomUUID(),
          additionalMinutes: 6,
        });
      }
      return result;
    };
    await voice.dispatchPending(created.room.id);
    const persisted = await prisma.room.findUniqueOrThrow({ where: { id: created.room.id } });
    expect(JSON.parse(provider.metadata!)).toEqual({
      schemaVersion: 1,
      stateVersion: persisted.stateVersion,
      endsAt: persisted.endsAt.toISOString(),
      extensionCount: 2,
    });
    await prisma.realtimeCommand.updateMany({
      where: { roomId: created.room.id, status: 'PENDING' },
      data: { nextAttemptAt: new Date(0) },
    });
    await voice.dispatchPending(created.room.id);
    await expect(realtime.operationStatus(created.room.id)).resolves.toMatchObject({
      providerStatus: 'COMPLETED',
    });
  });
});
