import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { Test, type TestingModule } from '@nestjs/testing';
import { MonitorWorkerModule } from '../../src/workers/monitor/monitor-worker.module.js';
import { installTestEnvironment, testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures } from '../fixtures/realtime.js';
import { randomUUID } from 'node:crypto';
import {
  IncidentsService,
  INCIDENTS_REPOSITORY,
  OBSERVABILITY_MONITOR_REPOSITORY,
  type MonitorClaim,
  type ObservabilityMonitorRepository,
  type IncidentsRepository,
} from '../../src/modules/operations/index.js';

describe('persistent monitor windows and fencing', () => {
  const prisma = new PrismaService(new ConfigService(testEnvironment()));
  const modules: TestingModule[] = [];
  const fixtureModule = async () => {
    const ref = await Test.createTestingModule({ imports: [MonitorWorkerModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(testEnvironment()))
      .compile();
    modules.push(ref);
    return ref;
  };
  const createRepository = async () =>
    (await fixtureModule()).get<ObservabilityMonitorRepository>(OBSERVABILITY_MONITOR_REPOSITORY);
  const createIncidentsRepository = async () =>
    (await fixtureModule()).get<IncidentsRepository>(INCIDENTS_REPOSITORY);
  const failure = {
    component: 'POSTGRESQL',
    category: 'READINESS' as const,
    enabled: true,
    ready: false,
    reasonCode: 'POSTGRESQL_UNAVAILABLE',
  };
  const base = new Date('2026-10-14T00:00:00Z');
  beforeAll(async () => {
    installTestEnvironment();
    await prisma.$connect();
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    await prisma.observabilityMonitorState.deleteMany();
  });
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await prisma.observabilityMonitorState.deleteMany();
    for (const ref of modules) await ref.close();
    await prisma.$disconnect();
  });
  const claimAt = async (window: number, now = base): Promise<MonitorClaim> => {
    const result = await (await createRepository()).claim('test', window, now, 45);
    if (result.kind !== 'claimed') throw new Error('Expected claim');
    return result.claim;
  };
  it('survives separate executions, counts each window once and recovers after restart', async () => {
    for (let window = 1; window <= 3; window++) {
      const claim = await claimAt(window);
      const repository = await createRepository();
      await repository.record(claim, failure, 3, 300, base);
      await repository.record(claim, failure, 3, 300, base);
      await repository.complete(claim, window + 1, base);
    }
    expect(await prisma.operationalIncident.count()).toBe(1);
    expect((await prisma.operationalIncident.findFirstOrThrow()).observationCount).toBe(1);
    const fourth = await claimAt(4);
    await (await createRepository()).record(fourth, { ...failure, ready: true }, 3, 300, base);
    expect((await prisma.operationalIncident.findFirstOrThrow()).status).toBe('RESOLVED');
    expect(await prisma.operationalAlertDelivery.count()).toBe(1);
  });
  it('rejects stale leases and duplicate concurrent owners', async () => {
    const stale = await claimAt(1);
    await expect(claimAt(1)).rejects.toThrow('MONITOR_SCAN_BUSY');
    const later = new Date(base.getTime() + 46_000);
    const current = await claimAt(1, later);
    await expect((await createRepository()).record(stale, failure, 1, 300, later)).rejects.toThrow(
      'MONITOR_LEASE_LOST',
    );
    await (await createRepository()).record(current, failure, 1, 300, later);
    await (await createRepository()).complete(current, 2, later);
    expect(await (await createRepository()).claim('test', 1, later, 45)).toEqual({
      kind: 'completed',
      nextWindow: 2,
    });
    expect(await prisma.operationalIncident.count()).toBe(1);
  });
  it('does not expose content or mark unknown provider readiness as healthy', async () => {
    const claim = await claimAt(1);
    await (
      await createRepository()
    ).record(
      claim,
      { ...failure, component: 'AI', reasonCode: 'AI_READINESS_UNKNOWN', unknown: true },
      1,
      300,
      base,
    );
    expect(await prisma.operationalIncident.count()).toBe(0);
    await expect(
      (await createRepository()).record(
        claim,
        { ...failure, reasonCode: 'PRIVATE_CANARY' },
        1,
        300,
        base,
      ),
    ).rejects.toThrow('INVALID_MONITOR_OBSERVATION');
  });
  it('counts overdue abandoned commands but excludes future work, active leases and terminal facts', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 180_000);
    const future = new Date(now.getTime() + 60_000);
    const user = await prisma.user.create({ data: { id: randomUUID() } });
    const room = await prisma.room.create({
      data: {
        id: randomUUID(),
        hostUserId: user.id,
        topic: 'Synthetic monitor fixture',
        cefrLevel: 'B1',
        capacity: 4,
        startedAt: past,
        endsAt: future,
      },
    });
    const commands: string[] = [];
    for (const [status, nextAttemptAt, lockedUntil] of [
      ['PENDING', past, null],
      ['RUNNING', past, past],
      ['PENDING', future, null],
      ['RUNNING', past, future],
      ['COMPLETED', past, null],
    ] as const) {
      const command = await prisma.realtimeCommand.create({
        data: {
          roomId: room.id,
          key: randomUUID(),
          type: 'DELETE_ROOM',
          stateVersion: 1,
          status,
          nextAttemptAt,
          lockedUntil,
          createdAt: past,
        },
      });
      commands.push(command.id);
    }
    const probes = await (await createRepository()).backlog(now, 120);
    expect(probes.find((probe) => probe.component === 'REALTIME_COMMAND')).toMatchObject({
      ready: false,
      reasonCode: 'COMMAND_BACKLOG',
    });
    await prisma.realtimeCommand.update({
      where: { id: commands[0]! },
      data: { status: 'COMPLETED' },
    });
    expect(
      (await (await createRepository()).backlog(now, 120)).find(
        (probe) => probe.component === 'REALTIME_COMMAND',
      ),
    ).toMatchObject({ ready: false });
    await prisma.realtimeCommand.update({
      where: { id: commands[1]! },
      data: { status: 'COMPLETED' },
    });
    expect(
      (await (await createRepository()).backlog(now, 120)).find(
        (probe) => probe.component === 'REALTIME_COMMAND',
      ),
    ).toMatchObject({ ready: true });
  });
  it('retains failed delivery across restart and fences old delivery owners before recovery notification', async () => {
    const claim = await claimAt(1, new Date());
    await (await createRepository()).record(claim, failure, 1, 300, new Date());
    const repository = await createIncidentsRepository();
    const first = await repository.claimDelivery(1, new Date());
    expect(first).not.toBeNull();
    await repository.failDelivery(first!, 'ALERT_SINK_TIMEOUT', new Date());
    const fresh = await createIncidentsRepository();
    const second = await fresh.claimDelivery(1, new Date());
    expect(second!.generation).toBeGreaterThan(first!.generation);
    const restarted = await fresh.claimDelivery(45, new Date(Date.now() + 2000));
    expect(restarted!.generation).toBeGreaterThan(second!.generation);
    await expect(repository.completeDelivery(first!, new Date())).rejects.toThrow();
    await expect(fresh.completeDelivery(second!, new Date())).rejects.toThrow();
    expect((await prisma.operationalAlertDelivery.findFirstOrThrow()).status).not.toBe('DELIVERED');
    await fresh.completeDelivery(restarted!, new Date());
    expect((await prisma.operationalAlertDelivery.findFirstOrThrow()).status).toBe('DELIVERED');
    await repository.recover({
      component: 'POSTGRESQL',
      category: 'READINESS',
      scopeType: 'GLOBAL',
      scopeKey: 'configured-provider',
      ruleVersion: 'readiness-v1',
      observedAt: new Date(),
    });
    const notifications: string[] = [];
    const service = new IncidentsService(
      fresh,
      {
        send: async (payload) => {
          notifications.push(payload.status);
        },
      },
      new ConfigService(testEnvironment({ OBSERVABILITY_MONITOR_ENABLED: true })),
    );
    await service.dispatchOne();
    expect(notifications).toEqual(['RESOLVED']);
  });
});
