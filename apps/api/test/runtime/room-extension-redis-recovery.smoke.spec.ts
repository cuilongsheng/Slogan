import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Test, type TestingModule } from '@nestjs/testing';

import type { Environment } from '../../src/config/environment.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { RealtimeQueue } from '../../src/infrastructure/redis/realtime-queue.service.js';
import { RoomRealtimeService, RoomsService } from '../../src/modules/rooms/index.js';
import { REALTIME_PROVIDER } from '../../src/modules/voice/index.js';
import { RealtimeRunner, VoiceService } from '../../src/modules/voice/testing.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import {
  clearRealtimeFixtures,
  FakeRealtimeProvider,
  realtimeEnvironment,
  seedAdult,
} from '../fixtures/realtime.js';

describe('room extension recovery while Redis restarts', () => {
  let ref: TestingModule;
  let prisma: PrismaService;
  let raw: Queue | undefined;
  let redis: Redis | undefined;

  afterAll(async () => {
    if (prisma) await clearRealtimeFixtures(prisma);
    await raw?.close();
    redis?.disconnect();
    if (ref) await ref.close();
  });

  it('keeps the room open past the old end and rebuilds expiry plus metadata work', async () => {
    const environment = realtimeEnvironment();
    const provider = new FakeRealtimeProvider();
    installTestEnvironment(environment);
    ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService<Environment, true>(environment))
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(provider)
      .compile();
    await ref.init();
    prisma = ref.get(PrismaService);
    await clearRealtimeFixtures(prisma);
    const rooms = ref.get(RoomsService);
    const realtime = ref.get(RoomRealtimeService);
    const voice = ref.get(VoiceService);
    const runner = ref.get(RealtimeRunner);
    const host = await seedAdult(prisma, 'Extension recovery host');
    const created = await rooms.create(host.id, {
      topic: 'Extension recovery',
      cefrLevel: 'B1',
      capacity: 3,
    });
    const originalEndsAt = new Date(Date.now() + 500);
    await prisma.room.update({
      where: { id: created.room.id },
      data: { endsAt: originalEndsAt, providerRoomSid: 'RM_test' },
    });
    const extended = await rooms.extend(host.id, created.room.id, {
      clientRequestId: randomUUID(),
      additionalMinutes: 1,
    });
    await voice.scheduleExpiry(created.room.id, extended.endsAt);

    await new Promise((resolve) => setTimeout(resolve, 750));
    await voice.expire(created.room.id);
    expect(await prisma.room.findUniqueOrThrow({ where: { id: created.room.id } })).toMatchObject({
      status: 'OPEN',
      endsAt: extended.endsAt,
    });

    const redisDeadline = Date.now() + 20_000;
    while (Date.now() < redisDeadline) {
      try {
        redis = new Redis(environment.REDIS_URL!, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
        await redis.connect();
        if ((await redis.ping()) === 'PONG') break;
      } catch {
        redis?.disconnect();
        redis = undefined;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    expect(redis).toBeDefined();
    raw = new Queue('slogan-realtime', { connection: redis! });
    await runner.recover();

    const convergenceDeadline = Date.now() + 10_000;
    while (Date.now() < convergenceDeadline && provider.metadata === null)
      await new Promise((resolve) => setTimeout(resolve, 100));
    expect(JSON.parse(provider.metadata!)).toMatchObject({
      schemaVersion: 1,
      endsAt: extended.endsAt.toISOString(),
      extensionCount: 1,
    });
    const expiryJobs = await raw.getJobs(['delayed', 'waiting']);
    expect(expiryJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: { kind: 'expiry', id: created.room.id },
        }),
      ]),
    );
    expect(await realtime.operationStatus(created.room.id)).toMatchObject({
      providerStatus: 'COMPLETED',
    });
    expect(ref.get(RealtimeQueue)).toBeDefined();
  }, 35_000);
});
