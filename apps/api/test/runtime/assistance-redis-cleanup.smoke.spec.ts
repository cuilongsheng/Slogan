import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Test, type TestingModule } from '@nestjs/testing';

import type { Environment } from '../../src/config/environment.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import type { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { AssistanceCoordinatorStore } from '../../src/infrastructure/redis/assistance-coordinator.service.js';
import {
  AssistanceMaintenanceQueue,
  AssistancePolicy,
  PrismaAssistanceRepository,
} from '../../src/modules/assistance/testing.js';
import { RoomsService } from '../../src/modules/rooms/index.js';
import { testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

const logger = { warn: () => undefined } as unknown as StructuredLogger;

function enabledEnvironment(overrides: Partial<Environment> = {}): Environment {
  return testEnvironment({
    ASSISTANCE_ENABLED: true,
    REDIS_URL: 'redis://127.0.0.1:56379/12',
    AI_EXPRESSION_PROVIDER_CATEGORY: 'FAKE_AI',
    AI_EXPRESSION_BASE_URL: 'http://localhost:4444',
    AI_EXPRESSION_API_KEY: 'fake-ai-key',
    AI_EXPRESSION_MODEL: 'fake-expression',
    AI_EXPRESSION_REGION: 'local',
    AI_EXPRESSION_RETENTION_SECONDS: 0,
    AI_EXPRESSION_NO_TRAINING: true,
    ...overrides,
  });
}

describe('assistance Redis limits and output cleanup runtime', () => {
  it('shares rate and concurrent limits across instances and fails closed', async () => {
    const rateEnvironment = enabledEnvironment({
      ASSISTANCE_RATE_LIMIT_POINTS: 2,
      ASSISTANCE_MAX_CONCURRENT: 20,
    });
    const first = new AssistanceCoordinatorStore(
      new ConfigService<Environment, true>(rateEnvironment),
      logger,
    );
    const second = new AssistanceCoordinatorStore(
      new ConfigService<Environment, true>(rateEnvironment),
      logger,
    );
    const redis = new Redis(rateEnvironment.REDIS_URL!, { maxRetriesPerRequest: 1 });
    const rateUser = randomUUID();
    try {
      await redis.flushdb();
      await (await first.acquire(rateUser)).release();
      await (await second.acquire(rateUser)).release();
      await expect(first.acquire(rateUser)).rejects.toMatchObject({
        code: 'ASSISTANCE_RATE_LIMITED',
        details: { retryAfterSeconds: expect.any(Number) },
      });

      await first.onModuleDestroy();
      await second.onModuleDestroy();
      const concurrentEnvironment = enabledEnvironment({
        ASSISTANCE_RATE_LIMIT_POINTS: 100,
        ASSISTANCE_MAX_CONCURRENT: 1,
      });
      const concurrentA = new AssistanceCoordinatorStore(
        new ConfigService<Environment, true>(concurrentEnvironment),
        logger,
      );
      const concurrentB = new AssistanceCoordinatorStore(
        new ConfigService<Environment, true>(concurrentEnvironment),
        logger,
      );
      const permit = await concurrentA.acquire(randomUUID());
      const sharedUser = randomUUID();
      const sharedPermit = await concurrentA.acquire(sharedUser);
      await expect(concurrentB.acquire(sharedUser)).rejects.toMatchObject({
        code: 'ASSISTANCE_RATE_LIMITED',
      });
      await sharedPermit.release();
      const replacement = await concurrentB.acquire(sharedUser);
      await replacement.release();
      await permit.release();
      await concurrentA.onModuleDestroy();
      await concurrentB.onModuleDestroy();

      const unavailable = new AssistanceCoordinatorStore(
        new ConfigService<Environment, true>(
          enabledEnvironment({ REDIS_URL: 'redis://127.0.0.1:1' }),
        ),
        logger,
      );
      await expect(unavailable.acquire(randomUUID())).rejects.toMatchObject({
        code: 'ASSISTANCE_UNAVAILABLE',
      });
      await unavailable.onModuleDestroy();
    } finally {
      redis.disconnect();
    }
  });

  it('purges scheduled output and recovers an expired unscheduled row from PostgreSQL', async () => {
    const environment = enabledEnvironment();
    let ref: TestingModule | undefined;
    let prisma: PrismaService | undefined;
    try {
      ref = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ConfigService)
        .useValue(new ConfigService<Environment, true>(environment))
        .compile();
      await ref.init();
      const db: PrismaService = ref.get(PrismaService);
      prisma = db;
      await clearRealtimeFixtures(db);
      const rooms = ref.get(RoomsService);
      const repository = ref.get(PrismaAssistanceRepository);
      const maintenance = ref.get(AssistanceMaintenanceQueue);
      const user = await seedAdult(db, 'Cleanup runtime user');
      const room = await rooms.create(user.id, { topic: 'Cleanup', cefrLevel: 'B1', capacity: 3 });
      const policy = new AssistancePolicy();

      const createSucceeded = async (value: string, expiresAt: Date) => {
        const reservation = await repository.reserve({
          userId: user.id,
          roomId: room.room.id,
          clientRequestId: randomUUID(),
          mode: 'TEXT',
          digest: policy.digest({ roomId: room.room.id, mode: 'TEXT', value }),
          inputSize: value.length,
          audioReservedSeconds: 0,
          now: new Date(),
        });
        if (reservation.kind !== 'NEW') throw new Error('expected new reservation');
        await repository.transition({
          requestId: reservation.requestId,
          leaseToken: reservation.leaseToken,
          from: ['RESERVED'],
          to: 'AI_RUNNING',
        });
        await repository.succeed({
          requestId: reservation.requestId,
          leaseToken: reservation.leaseToken,
          output: {
            primary: { text: 'Temporary', tone: 'NEUTRAL' },
            alternatives: [],
            noticeCode: 'AI_OUTPUT_MAY_BE_INACCURATE',
          },
          generatedAt: new Date(),
          expiresAt,
        });
        return reservation.requestId;
      };

      const scheduledId = await createSucceeded('scheduled', new Date(Date.now() + 250));
      await maintenance.scheduleExpiry(scheduledId, new Date(Date.now() + 250));
      const deadline = Date.now() + 5000;
      while (
        Date.now() < deadline &&
        (await db.aiExpressionRequest.findUniqueOrThrow({ where: { id: scheduledId } })).output !==
          null
      )
        await new Promise((resolve) => setTimeout(resolve, 50));
      expect(
        await db.aiExpressionRequest.findUniqueOrThrow({ where: { id: scheduledId } }),
      ).toMatchObject({ output: null, outputExpiresAt: null, outputPurgedAt: expect.any(Date) });

      const recoveredId = await createSucceeded('recovered', new Date(Date.now() - 1));
      await maintenance.onModuleInit();
      expect(
        await db.aiExpressionRequest.findUniqueOrThrow({ where: { id: recoveredId } }),
      ).toMatchObject({ output: null, outputExpiresAt: null, outputPurgedAt: expect.any(Date) });
      expect(await repository.purgeExpired(recoveredId)).toBe(0);
    } finally {
      if (prisma) await clearRealtimeFixtures(prisma);
      if (ref) await ref.close();
    }
  }, 15_000);
});
