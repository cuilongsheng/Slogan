import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Environment } from '../../src/config/environment.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { MetricsService } from '../../src/modules/operations/index.js';
import { installTestEnvironment, testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

describe('operations metric bounded PostgreSQL query', () => {
  let ref: TestingModule, prisma: PrismaService, metrics: MetricsService;
  beforeAll(async () => {
    installTestEnvironment();
    ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService<Environment, true>(testEnvironment()))
      .compile();
    prisma = ref.get(PrismaService);
    metrics = ref.get(MetricsService);
    await prisma.$connect();
  });
  beforeEach(() => clearRealtimeFixtures(prisma));
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await ref.close();
  });

  it('uses a bounded indexed window over a repeatable 1,000 snapshot fixture', async () => {
    const actor = await seedAdult(prisma);
    const runId = randomUUID();
    await prisma.metricComputationRun.create({
      data: {
        id: runId,
        grain: 'DAY',
        windowStart: new Date('2025-01-01'),
        windowEnd: new Date('2025-01-02'),
        definitionVersion: 'scale-v1',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    await prisma.metricSnapshot.createMany({
      data: Array.from({ length: 1_000 }, (_, index) => ({
        id: randomUUID(),
        runId,
        metricKey: 'PROFILE_COMPLETION_RATE',
        grain: 'DAY' as const,
        windowStart: new Date(Date.UTC(2025, 0, 1 + (index % 300))),
        windowEnd: new Date(Date.UTC(2025, 0, 2 + (index % 300))),
        dimensionKey: JSON.stringify({ CEFR: `GROUP_${index}` }),
        dimensions: { CEFR: `GROUP_${index}` },
        definitionVersion: 'scale-v1',
        status: 'COMPLETE' as const,
        value: 0.5,
        numerator: 50n,
        denominator: 100n,
        sampleSize: 100,
        dataThroughAt: new Date('2026-01-01'),
      })),
    });
    const started = performance.now();
    const result = await metrics.list(actor.id, ['PLATFORM_ADMIN'], {
      from: new Date('2025-01-01'),
      to: new Date('2026-01-01'),
      limit: 100,
    });
    expect(result.items).toHaveLength(100);
    expect(result.nextCursor).toEqual(expect.any(String));
    expect(performance.now() - started).toBeLessThan(2_000);
    await prisma.$executeRawUnsafe('SET enable_seqscan = off');
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      'EXPLAIN SELECT id FROM "MetricSnapshot" WHERE "windowStart" >= $1 AND "windowStart" < $2 ORDER BY "windowStart" DESC,id DESC LIMIT 101',
      new Date('2025-01-01'),
      new Date('2026-01-01'),
    );
    expect(plan.map((row) => row['QUERY PLAN']).join('\n')).toMatch(/Index/);
    await prisma.$executeRawUnsafe('RESET enable_seqscan');
  });

  it('filters the complete operations room queue and binds pagination to its filters', async () => {
    const actor = await seedAdult(prisma);
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await prisma.room.createMany({
      data: [
        {
          id: ids[0]!,
          hostUserId: actor.id,
          topic: 'English movies',
          cefrLevel: 'B1',
          capacity: 4,
          status: 'OPEN',
          visibility: 'PUBLIC',
          startedAt: new Date('2026-09-25'),
          endsAt: new Date('2026-09-26'),
          createdAt: new Date('2026-09-25'),
        },
        {
          id: ids[1]!,
          hostUserId: actor.id,
          topic: 'MOVIE chat',
          cefrLevel: 'B1',
          capacity: 4,
          status: 'OPEN',
          visibility: 'PUBLIC',
          startedAt: new Date('2026-09-26'),
          endsAt: new Date('2026-09-27'),
          createdAt: new Date('2026-09-26'),
        },
        {
          id: ids[2]!,
          hostUserId: actor.id,
          topic: 'Movie club',
          cefrLevel: 'B1',
          capacity: 4,
          status: 'ENDED',
          visibility: 'LINK_ONLY',
          startedAt: new Date('2026-09-27'),
          endsAt: new Date('2026-09-28'),
          createdAt: new Date('2026-09-27'),
        },
      ],
    });
    await prisma.room.createMany({
      data: [
        {
          id: ids[3]!,
          hostUserId: actor.id,
          topic: 'Scheduled',
          kind: 'APPOINTMENT',
          cefrLevel: 'B1',
          capacity: 4,
          status: 'SCHEDULED',
          visibility: 'PUBLIC',
          startedAt: new Date('2026-09-28'),
          initialHostDeadline: new Date('2026-09-28T00:05:00Z'),
          endsAt: new Date('2026-09-29'),
          createdAt: new Date('2026-09-28'),
        },
        {
          id: ids[4]!,
          hostUserId: actor.id,
          topic: 'Cancelled',
          kind: 'APPOINTMENT',
          cefrLevel: 'B1',
          capacity: 4,
          status: 'CANCELLED',
          visibility: 'PUBLIC',
          startedAt: new Date('2026-09-29'),
          initialHostDeadline: new Date('2026-09-29T00:05:00Z'),
          endsAt: new Date('2026-09-30'),
          createdAt: new Date('2026-09-29'),
        },
      ],
    });
    const allCurrent = await metrics.rooms(actor.id, ['PLATFORM_ADMIN'], {
      scope: 'CURRENT',
      limit: 20,
    });
    expect(allCurrent.items.map((item) => item.id)).toEqual([ids[3], ids[1], ids[0]]);
    await prisma.room.update({ where: { id: ids[1]! }, data: { status: 'ENDED' } });
    const refreshed = await metrics.rooms(actor.id, ['PLATFORM_ADMIN'], {
      scope: 'CURRENT',
      limit: 20,
    });
    expect(refreshed.items.map((item) => item.id)).toEqual([ids[3], ids[0]]);
    expect(await prisma.room.count()).toBe(5);
    await prisma.room.update({ where: { id: ids[1]! }, data: { status: 'OPEN' } });
    const filter = {
      q: ' movie ',
      status: 'OPEN' as const,
      visibility: 'PUBLIC' as const,
      from: new Date('2026-09-24'),
      limit: 1,
    };
    const first = await metrics.rooms(actor.id, ['PLATFORM_ADMIN'], filter);
    expect(first.items.map((item) => item.id)).toEqual([ids[1]]);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await metrics.rooms(actor.id, ['PLATFORM_ADMIN'], {
      ...filter,
      cursor: first.nextCursor!,
    });
    expect(second.items.map((item) => item.id)).toEqual([ids[0]]);
    expect(second.nextCursor).toBeNull();
    await expect(
      metrics.rooms(actor.id, ['PLATFORM_ADMIN'], {
        ...filter,
        status: 'ENDED',
        cursor: first.nextCursor!,
      }),
    ).rejects.toMatchObject({ code: 'OPERATIONS_VALIDATION_FAILED' });
    const current = await metrics.rooms(actor.id, ['PLATFORM_ADMIN'], {
      scope: 'CURRENT',
      limit: 1,
    });
    expect(current.items.every((item) => ['OPEN', 'SCHEDULED'].includes(String(item.status)))).toBe(
      true,
    );
    await expect(
      metrics.rooms(actor.id, ['PLATFORM_ADMIN'], { limit: 1, cursor: current.nextCursor! }),
    ).rejects.toMatchObject({ code: 'OPERATIONS_VALIDATION_FAILED' });
    const exact = await metrics.rooms(actor.id, ['PLATFORM_ADMIN'], { q: ids[2]!, limit: 20 });
    expect(exact.items.map((item) => item.id)).toEqual([ids[2]]);
  });
});
