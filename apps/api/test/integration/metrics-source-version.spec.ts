import { randomUUID } from 'node:crypto';
const jest = import.meta.jest;
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { MetricsService } from '../../src/modules/operations/index.js';
import { PrismaMetricsRepository } from '../../src/modules/operations/testing.js';
import { installTestEnvironment, testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures } from '../fixtures/realtime.js';
describe('committed source watermark caching', () => {
  let ref: TestingModule,
    prisma: PrismaService,
    metrics: MetricsService,
    repository: PrismaMetricsRepository;
  const day = new Date('2025-01-03T00:00:00Z');
  beforeAll(async () => {
    installTestEnvironment({ OPERATIONS_GOVERNANCE_ENABLED: true });
    ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(testEnvironment({ OPERATIONS_GOVERNANCE_ENABLED: true })))
      .compile();
    prisma = ref.get(PrismaService);
    metrics = ref.get(MetricsService);
    repository = ref.get(PrismaMetricsRepository);
  });
  beforeEach(async () => {
    await prisma.metricSnapshot.deleteMany();
    await prisma.metricComputationRun.deleteMany();
    await clearRealtimeFixtures(prisma);
  });
  afterAll(async () => {
    await prisma.metricSnapshot.deleteMany();
    await prisma.metricComputationRun.deleteMany();
    await clearRealtimeFixtures(prisma);
    await ref.close();
  });
  test('completed window reuses facts, late committed data and algorithm version force computation', async () => {
    const compute = jest.spyOn(repository, 'compute');
    try {
      const first = await metrics.generate('DAY', day);
      const tx = jest.spyOn(prisma, '$transaction');
      try {
        expect(await metrics.generate('DAY', day)).toEqual(first);
        expect(compute).toHaveBeenCalledTimes(1);
        expect(tx).not.toHaveBeenCalled();
      } finally {
        tx.mockRestore();
      }
      await prisma.user.create({ data: { id: randomUUID(), createdAt: day } });
      await metrics.generate('DAY', day);
      expect(compute).toHaveBeenCalledTimes(2);
      const next = new MetricsService(
        repository,
        new ConfigService(
          testEnvironment({
            OPERATIONS_GOVERNANCE_ENABLED: true,
            OPERATIONS_METRIC_DEFINITION_VERSION: 'cache-v2',
          }),
        ),
      );
      await next.generate('DAY', day);
      expect(compute).toHaveBeenCalledTimes(3);
    } finally {
      compute.mockRestore();
    }
  });
  test('rolled back facts do not change the watermark; a transaction committing later always does', async () => {
    const before = await prisma.metricSourceVersion.count();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({ data: { id: randomUUID(), createdAt: day } });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await prisma.metricSourceVersion.count()).toBe(before);
    let release!: () => void, started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = prisma.$transaction(
      async (tx) => {
        await tx.user.create({ data: { id: randomUUID(), createdAt: day } });
        started();
        await gate;
      },
      { timeout: 15000 },
    );
    await entered;
    try {
      await metrics.generate('DAY', day);
    } finally {
      release();
      await held;
    }
    const compute = jest.spyOn(repository, 'compute');
    try {
      await metrics.generate('DAY', day);
      expect(compute).toHaveBeenCalledTimes(1);
    } finally {
      compute.mockRestore();
    }
  });
  test('seven-day metric maturity invalidates an otherwise unchanged source version', async () => {
    const compute = jest.spyOn(repository, 'compute');
    try {
      await metrics.generate('DAY', day, new Date('2025-01-05'));
      await metrics.generate('DAY', day, new Date('2025-01-06'));
      expect(compute).toHaveBeenCalledTimes(1);
      await metrics.generate('DAY', day, new Date('2025-01-12'));
      expect(compute).toHaveBeenCalledTimes(2);
    } finally {
      compute.mockRestore();
    }
  });
});
