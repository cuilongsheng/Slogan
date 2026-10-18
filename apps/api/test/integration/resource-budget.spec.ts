const jest = import.meta.jest;
import { writeFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import { Redis } from 'ioredis';
import request from 'supertest';
import type { Environment } from '../../src/config/environment.js';
import { installTestEnvironment, testEnvironment } from '../fixtures/environment.js';
import { seedAdult, clearRealtimeFixtures, FakeRealtimeProvider } from '../fixtures/realtime.js';
const deliveries: Array<{ topic: string; job: never; options: { delaySeconds?: number } }> = [];
(
  jest as typeof jest & { unstable_mockModule(name: string, factory: () => unknown): void }
).unstable_mockModule('@vercel/queue', () => ({
  QueueClient: class {
    async send(topic: string, job: never, options: { delaySeconds?: number } = {}) {
      deliveries.push({ topic, job, options });
      return { messageId: 'fixture' };
    }
  },
}));
const { AppModule } = await import('../../src/app.module.js');
const { configureApiApp } = await import('../../src/bootstrap/create-api-app.js');
const { configureManagedRecovery } = await import('../../src/bootstrap/managed-recovery.js');
const { PrismaService } = await import('../../src/infrastructure/database/prisma.service.js');
const { SessionService } = await import('../../src/modules/auth/index.js');
const { RoomsService } = await import('../../src/modules/rooms/index.js');
const { LiveUpdatesService } = await import('../../src/modules/live-updates/index.js');
const { MaintenanceService } = await import('../../src/modules/maintenance/index.js');
const { RealtimeQueue } = await import('../../src/infrastructure/redis/realtime-queue.service.js');
const { REALTIME_PROVIDER } = await import('../../src/modules/voice/index.js');

test('records warm managed foreground, background and empty-fallback budgets on isolated PostgreSQL/Redis', async () => {
  const previous = {
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_DEPLOYMENT_ID: process.env.VERCEL_DEPLOYMENT_ID,
  };
  const contextKey = Symbol.for('@vercel/request-context');
  const registry = globalThis as unknown as Record<symbol, unknown>;
  const priorContext = registry[contextKey];
  const tracked: Promise<unknown>[] = [];
  registry[contextKey] = {
    get: () => ({ waitUntil: (promise: Promise<unknown>) => tracked.push(promise) }),
  };
  process.env.VERCEL = '1';
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL_DEPLOYMENT_ID = 'dpl_budget';
  const environment = testEnvironment({
    REALTIME_ENABLED: true,
    LIVEKIT_URL: 'wss://isolated-test.livekit.cloud',
    LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'test-livekit-secret-with-at-least-32-characters',
    REDIS_URL: 'redis://127.0.0.1:56379/12',
  });
  installTestEnvironment(environment);
  let app: INestApplication | undefined;
  const counts: Record<
    string,
    { sql: number; redis: number; redisIncludingLua: number; queued: number }
  > = {};
  const sql: string[] = [],
    commands: string[] = [];
  let recording = false,
    recordingLua = false,
    luaCommands = 0;
  const monitorSource = new Redis(environment.REDIS_URL!);
  const monitor = await monitorSource.monitor();
  const barrier = new Redis(environment.REDIS_URL!);
  let marker = '',
    observed: (() => void) | undefined;
  monitor.on('monitor', (_time: string, args: string[], source: string, database: string) => {
    if (args[0]?.toLowerCase() === 'echo' && args[1] === marker) observed?.();
    if (recordingLua && source === 'lua' && String(database) === '12') luaCommands++;
  });
  async function flushMonitor() {
    marker = `budget-barrier-${Math.random()}`;
    const seen = new Promise<void>((resolve) => {
      observed = resolve;
    });
    await barrier.echo(marker);
    await seen;
    observed = undefined;
  }
  const originalQuery = pg.Client.prototype.query;
  const originalCommand = Redis.prototype.sendCommand;
  const query = jest.spyOn(pg.Client.prototype, 'query').mockImplementation(function (
    this: pg.Client,
    ...args: unknown[]
  ) {
    if (recording)
      sql.push(
        typeof args[0] === 'string' ? args[0] : ((args[0] as { text?: string })?.text ?? 'unknown'),
      );
    return (originalQuery as (...args: unknown[]) => unknown).apply(this, args);
  } as never);
  const command = jest.spyOn(Redis.prototype, 'sendCommand').mockImplementation(function (
    this: Redis,
    ...args: unknown[]
  ) {
    if (recording) commands.push((args[0] as { name: string }).name);
    return (originalCommand as (...args: unknown[]) => unknown).apply(this, args);
  } as never);
  try {
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService<Environment, true>(environment))
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(Object.assign(new FakeRealtimeProvider(), { roomSid: 'RM_test' }))
      .compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    configureManagedRecovery(app);
    await app.init();
    const prisma = ref.get(PrismaService),
      sessions = ref.get(SessionService),
      rooms = ref.get(RoomsService),
      live = ref.get(LiveUpdatesService),
      maintenance = ref.get(MaintenanceService),
      queue = ref.get(RealtimeQueue);
    await clearRealtimeFixtures(prisma);
    await prisma.managedWorkerOwner.upsert({
      where: { key: 'background' },
      create: { key: 'background', deploymentId: 'dpl_budget', generation: 1 },
      update: { deploymentId: 'dpl_budget', generation: 1 },
    });
    const host = await seedAdult(prisma, 'Budget host'),
      member = await seedAdult(prisma, 'Budget member');
    const pair = await sessions.issue(member.id);
    const token = pair.accessToken,
      hostToken = (await sessions.issue(host.id)).accessToken;
    const room = (
      await rooms.create(host.id, { topic: 'Budget room', cefrLevel: 'B1', capacity: 4 })
    ).room;
    await live.recover();
    await live.sweepPresence();
    async function drain() {
      while (tracked.length) await Promise.all(tracked.splice(0));
      let passes = 0;
      while (deliveries.some((delivery) => !delivery.options.delaySeconds)) {
        if (++passes > 50) throw new Error('Unexpected immediate queue chain');
        const index = deliveries.findIndex((delivery) => !delivery.options.delaySeconds);
        const [delivery] = deliveries.splice(index, 1);
        if (delivery!.topic === 'slogan-maintenance') await maintenance.process(delivery!.job);
        else if (delivery!.topic === 'slogan-realtime')
          await queue.process(delivery!.job, () => live.recover());
      }
    }
    async function measure(name: string, work: () => Promise<unknown>, background = false) {
      await drain();
      deliveries.length = 0;
      await flushMonitor();
      sql.length = 0;
      commands.length = 0;
      luaCommands = 0;
      recordingLua = true;
      recording = true;
      await work();
      if (background) await drain();
      recording = false;
      await flushMonitor();
      recordingLua = false;
      counts[name] = {
        sql: sql.length,
        redis: commands.filter(
          (name) =>
            ![
              'auth',
              'hello',
              'select',
              'command',
              'config',
              'info',
              'ping',
              'reset',
              'quit',
            ].includes(name),
        ).length,
        redisIncludingLua: 0,
        queued: deliveries.length,
      };
      counts[name]!.redisIncludingLua = counts[name]!.redis + luaCommands;
      // Drain after the foreground boundary so subsequent measurements start clean.
      await drain();
    }
    const api = () => request(app!.getHttpServer());
    await measure('heartbeat-first', async () => {
      await api()
        .post('/v1/me/presence/heartbeat')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
    });
    await measure('heartbeat-steady', async () => {
      await api()
        .post('/v1/me/presence/heartbeat')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
    });
    expect(counts['heartbeat-steady']).toMatchObject({ sql: 1, redis: 1, redisIncludingLua: 5 });
    await measure(
      'join-foreground-and-immediate-workers',
      async () => {
        await api()
          .post(`/v1/rooms/${room.id}/memberships`)
          .set('authorization', `Bearer ${token}`)
          .send({ rulesAccepted: true })
          .expect(201);
      },
      true,
    );
    const credential = () =>
      api()
        .post(`/v1/rooms/${room.id}/realtime-credentials`)
        .set('authorization', `Bearer ${token}`);
    await measure(
      'credential-first',
      async () => {
        await credential().expect(200);
      },
      true,
    );
    await measure(
      'credential-unchanged-SID',
      async () => {
        await credential().expect(200);
      },
      true,
    );
    expect(counts['credential-unchanged-SID']!.redis).toBe(0);
    await measure('SSE-outbox-single-publication', async () => {
      await prisma.liveUpdateOutbox.create({ data: { scope: 'account', ownerId: member.id } });
      await live.recover();
    });
    const membership = await prisma.roomMembership.findUniqueOrThrow({
      where: { roomId_userId: { roomId: room.id, userId: member.id } },
    });
    await measure(
      'leave-foreground-and-immediate-workers',
      async () => {
        await api()
          .post(`/v1/rooms/${room.id}/leave`)
          .set('authorization', `Bearer ${token}`)
          .send({ expectedCredentialVersion: membership.credentialVersion })
          .expect(200);
      },
      true,
    );
    const warmedRefresh = await api()
      .post('/v1/auth/refresh')
      .send({ refreshToken: pair.refreshToken })
      .expect(200);
    await drain();
    await measure(
      'refresh-steady',
      async () => {
        await api()
          .post('/v1/auth/refresh')
          .send({ refreshToken: warmedRefresh.body.refreshToken })
          .expect(200);
      },
      true,
    );
    // Empty means no durable domain work, no online presence, no active rooms.
    await clearRealtimeFixtures(prisma);
    await prisma.liveUpdateOutbox.deleteMany();
    const redis = new Redis(environment.REDIS_URL!);
    await redis.del(
      'slogan:live:presence-expiries',
      `social:presence:${member.id}`,
      `slogan:live:presence-chain:${member.id}`,
    );
    await redis.del('slogan:live:release-check');
    await redis.set('slogan:live:release-version', '1');
    const metadata = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          versionCode: 1,
          version: '0.0.1',
          commit: 'a'.repeat(40),
          sha256: 'b'.repeat(64),
          bytes: 1,
          package: 'com.slogan.mobile',
          apiOrigin: 'https://slogan-api-pi.vercel.app',
          signing: 'controlled-debug',
          certificateSha256: 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c',
        }),
        { status: 200 },
      ),
    );
    await measure('empty-owner-fallback', () =>
      maintenance.process({
        kind: 'fallback',
        owner: { deploymentId: 'dpl_budget', generation: 1 },
      }),
    );
    expect(counts['empty-owner-fallback']).toMatchObject({
      sql: 3,
      redis: 3,
      redisIncludingLua: 5,
      queued: 1,
    });
    metadata.mockRestore();
    await redis.del('slogan:live:release-check', 'slogan:live:release-version');
    await prisma.managedWorkerOwner.update({
      where: { key: 'background' },
      data: { generation: 2 },
    });
    await measure('stale-generation-callback', () =>
      maintenance.process({
        kind: 'fallback',
        owner: { deploymentId: 'dpl_budget', generation: 1 },
      }),
    );
    expect(counts['stale-generation-callback']).toEqual({
      sql: 1,
      redis: 0,
      redisIncludingLua: 0,
      queued: 0,
    });
    await measure('legacy-unstamped-callback', () => maintenance.process({ kind: 'maintenance' }));
    expect(counts['legacy-unstamped-callback']).toEqual({
      sql: 0,
      redis: 0,
      redisIncludingLua: 0,
      queued: 0,
    });
    await prisma.managedWorkerOwner.deleteMany();
    await redis.quit();
    expect(hostToken).toBeTruthy();
    console.log('RESOURCE_BUDGET', JSON.stringify(counts));
    if (process.env.SLOGAN_RESOURCE_BUDGET_OUTPUT)
      await writeFile(
        process.env.SLOGAN_RESOURCE_BUDGET_OUTPUT,
        JSON.stringify(counts, null, 2) + '\n',
      );
  } finally {
    recording = false;
    recordingLua = false;
    monitor.disconnect();
    monitorSource.disconnect();
    barrier.disconnect();
    jest.restoreAllMocks();
    query.mockRestore();
    command.mockRestore();
    await app?.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (priorContext === undefined) delete registry[contextKey];
    else registry[contextKey] = priorContext;
    installTestEnvironment();
  }
}, 30000);
