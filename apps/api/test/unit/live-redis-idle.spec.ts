const jest = import.meta.jest;
import { ConfigService } from '@nestjs/config';
import { RedisLiveUpdatesStore } from '../../src/modules/live-updates/infrastructure/redis-live-updates.store.js';
import { LiveUpdatesService } from '../../src/modules/live-updates/application/live-updates.service.js';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import type { SessionService } from '../../src/modules/auth/index.js';
import type { SocialService } from '../../src/modules/social/index.js';
import { testEnvironment } from '../fixtures/environment.js';

type Reply = Array<[string, Array<[string, string[]]>]> | null;
class BlockingRedis {
  status = 'ready';
  readonly calls: unknown[][] = [];
  readonly connections: BlockingRedis[] = [];
  pending:
    | {
        resolve: (value: Reply) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  connect = async () => undefined;
  on = () => this;
  eval = jest.fn(async () => []);
  xrange = async () => [];
  xrevrange = async () => [];
  duplicate = () => {
    const connection = new BlockingRedis();
    this.connections.push(connection);
    return connection;
  };
  xread = (...args: unknown[]) => {
    this.calls.push(args);
    return new Promise<Reply>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = undefined;
        resolve(null);
      }, Number(args[3]));
      this.pending = { resolve, reject, timer };
    });
  };
  deliver(reply: Reply) {
    if (!this.pending) throw new Error('No pending read');
    clearTimeout(this.pending.timer);
    this.pending.resolve(reply);
    this.pending = undefined;
  }
  disconnect() {
    this.status = 'end';
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error('Connection closed'));
      this.pending = undefined;
    }
  }
}
function setup() {
  const redis = new BlockingRedis();
  const prisma = {
    liveUpdateOutbox: { findFirst: jest.fn(async () => null) },
    $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) =>
      work({ $queryRaw: async () => [] }),
    ),
  } as unknown as PrismaService;
  const store = new RedisLiveUpdatesStore(
    new ConfigService(testEnvironment({ REDIS_URL: 'redis://test' })),
    prisma,
  );
  Object.assign(store, { client: redis });
  return { redis, store, prisma };
}
const flush = async () => {
  await jest.advanceTimersByTimeAsync(0);
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(1_005_000);
});
afterEach(() => {
  jest.useRealTimers();
});

test('ten idle minutes need 40 XREADs, no periodic scan, and only three connection preflights', async () => {
  const { redis, store, prisma } = setup(),
    controller = new AbortController(),
    start = Date.now();
  const sessions = {
    streamIdentity: async () => ({
      userId: 'owner',
      sessionId: 'session',
      expiresAt: start + 3600000,
    }),
    verifyAccessToken: jest.fn(async () => ({ userId: 'owner', sessionId: 'session' })),
    isPublicTrialViewer: async () => false,
  };
  const service = new LiveUpdatesService(
    store,
    sessions as unknown as SessionService,
    { assertEligible: async () => undefined } as unknown as SocialService,
    new ConfigService(testEnvironment()),
  );
  const consume = (async () => {
    while (!controller.signal.aborted) {
      for await (const _frame of await service.open('token', undefined, controller.signal, 2)) {
        expect(_frame.scope).toBeDefined();
        if (Date.now() - start >= 600000) controller.abort();
      }
    }
  })();
  await flush();
  await jest.advanceTimersByTimeAsync(600000);
  await consume;
  expect(redis.connections.flatMap((c) => c.calls)).toHaveLength(40);
  expect(redis.eval).not.toHaveBeenCalled();
  expect(prisma.liveUpdateOutbox.findFirst).toHaveBeenCalledTimes(3);
  expect(prisma.$transaction).not.toHaveBeenCalled();
  expect(sessions.verifyAccessToken).toHaveBeenCalledTimes(38);
  expect(redis.connections.every((c) => c.status === 'end')).toBe(true);
  store.onModuleDestroy();
});

test('new private subscription interrupts the old wait and gets an immediate private event', async () => {
  const { store, redis } = setup(),
    a = new AbortController(),
    b = new AbortController();
  const first = await store.reader('alice', a.signal),
    pending = first.read(['0-0', '0-0']);
  await flush();
  const old = redis.connections[0]!;
  const second = await store.reader('bob', b.signal),
    next = second.read(['0-0', '0-0']);
  await flush();
  expect(old.status).toBe('end');
  const active = redis.connections.at(-1)!;
  expect(active.calls[0]).toContain('slogan:live:owner:bob');
  active.deliver([['slogan:live:owner:bob', [['1-0', ['scope', 'account']]]]]);
  expect(await next).toMatchObject([{ id: '1-0', scope: 'account' }]);
  expect(await pending).toEqual([]);
  first.close();
  second.close();
  store.onModuleDestroy();
});

test('the earliest subscriber deadline bounds BLOCK and closing it preserves the other pending reader', async () => {
  const { store, redis } = setup();
  const a = await store.reader('alice', new AbortController().signal);
  const b = await store.reader('bob', new AbortController().signal);
  const first = a.read(['0-0', '0-0'], Date.now() + 2000);
  const rejected = expect(first).rejects.toThrow('Stream cancelled');
  const second = b.read(['0-0', '0-0']);
  await flush();
  expect(redis.connections.at(-1)!.calls[0]![3]).toBe(2000);
  a.close();
  await rejected;
  await flush();
  redis.connections.at(-1)!.deliver([['slogan:live:public', [['1-0', ['scope', 'rooms']]]]]);
  expect(await second).toMatchObject([{ scope: 'rooms' }]);
  b.close();
  store.onModuleDestroy();
});

test('abort ends the last wait immediately and genuine Redis failure still rejects', async () => {
  const { store, redis } = setup(),
    controller = new AbortController();
  const reader = await store.reader('alice', controller.signal);
  const pending = reader.read(['0-0', '0-0']);
  const cancelled = expect(pending).rejects.toThrow('Stream cancelled');
  await flush();
  controller.abort();
  await cancelled;
  await flush();
  expect(redis.connections[0]!.status).toBe('end');
  const next = await store.reader('bob', new AbortController().signal);
  const failed = next.read(['0-0', '0-0']);
  const rejected = expect(failed).rejects.toThrow('Redis unavailable');
  await flush();
  const connection = redis.connections.at(-1)!;
  clearTimeout(connection.pending!.timer);
  connection.pending!.reject(new Error('Redis unavailable'));
  connection.pending = undefined;
  await rejected;
  next.close();
  store.onModuleDestroy();
});

test('subscriber arrival racing with a delivered reply replays unchanged positions without losing it', async () => {
  const { store, redis } = setup();
  const first = await store.reader('alice', new AbortController().signal);
  const second = await store.reader('bob', new AbortController().signal);
  const pending = first.read(['0-0', '0-0']);
  await flush();
  const reply: Reply = [['slogan:live:public', [['1-0', ['scope', 'rooms']]]]];
  redis.connections[0]!.deliver(reply);
  const next = second.read(['0-0', '0-0']);
  await flush();
  const active = redis.connections.at(-1)!;
  expect(active.calls[0]!.slice(-3)).toEqual(['0-0', '0-0', '0-0']);
  active.deliver(reply);
  expect(await pending).toMatchObject([{ id: '1-0', scope: 'rooms' }]);
  expect(await next).toMatchObject([{ id: '1-0', scope: 'rooms' }]);
  first.close();
  second.close();
  store.onModuleDestroy();
});

test('five staggered subscribers share aligned checkpoints instead of five idle read clocks', async () => {
  const { store, redis } = setup(),
    start = Date.now(),
    stop = start + 600000;
  const sessions = {
    streamIdentity: async (token: string) => ({
      userId: token,
      sessionId: token,
      expiresAt: start + 3600000,
      eligible: true,
      trial: false,
    }),
    verifyAccessToken: async (token: string) => ({ userId: token, sessionId: token }),
    isPublicTrialViewer: async () => false,
  };
  const service = new LiveUpdatesService(
    store,
    sessions as unknown as SessionService,
    { assertEligible: async () => {} } as unknown as SocialService,
    new ConfigService(testEnvironment()),
  );
  const controllers = Array.from({ length: 5 }, () => new AbortController());
  const consumers: Promise<void>[] = [];
  for (let i = 0; i < 5; i++) {
    const controller = controllers[i]!;
    consumers.push(
      (async () => {
        try {
          while (!controller.signal.aborted)
            for await (const _frame of await service.open(
              `user-${i}`,
              undefined,
              controller.signal,
              2,
            )) {
              expect(_frame.scope).toBeDefined();
              if (Date.now() >= stop) controller.abort();
            }
        } catch (error) {
          if (!controller.signal.aborted) throw error;
        }
      })(),
    );
    await flush();
    await jest.advanceTimersByTimeAsync(1000);
  }
  await jest.advanceTimersByTimeAsync(stop - Date.now());
  await Promise.all(consumers);
  const reads = redis.connections.flatMap((c) => c.calls).length;
  console.log('IDLE_READER_BUDGET', JSON.stringify({ users: 5, minutes: 10, xreads: reads }));
  expect(reads).toBeGreaterThanOrEqual(40);
  expect(reads).toBeLessThanOrEqual(60);
  expect(redis.connections.every((c) => c.status === 'end')).toBe(true);
  store.onModuleDestroy();
});

test('a subscriber doing authorization retains private events without exposing them to another reader', async () => {
  const { store, redis } = setup(),
    a = new AbortController(),
    b = new AbortController();
  const alice = await store.reader('alice', a.signal),
    bob = await store.reader('bob', b.signal);
  const first = alice.read(['0-0', '0-0']),
    second = bob.read(['0-0', '0-0']);
  await flush();
  redis.connections.at(-1)!.deliver(null);
  await Promise.all([first, second]);
  const waiting = bob.read(['0-0', '0-0']);
  await flush();
  redis.connections.at(-1)!.deliver([['slogan:live:owner:alice', [['1-0', ['scope', 'account']]]]]);
  expect(await waiting).toEqual([]);
  const reads = redis.connections.flatMap((c) => c.calls).length;
  expect(await alice.read(['0-0', '0-0'])).toEqual([{ index: 1, id: '1-0', scope: 'account' }]);
  expect(redis.connections.flatMap((c) => c.calls)).toHaveLength(reads);
  a.abort();
  b.abort();
  store.onModuleDestroy();
});

test('a slow authorization consumer has a bounded private backlog and reconnects instead of growing memory', async () => {
  const { store, redis } = setup(),
    a = new AbortController(),
    b = new AbortController();
  const alice = await store.reader('alice', a.signal),
    bob = await store.reader('bob', b.signal);
  const first = alice.read(['0-0', '0-0']),
    second = bob.read(['0-0', '0-0']);
  await flush();
  redis.connections.at(-1)!.deliver(null);
  await Promise.all([first, second]);
  let position = 0;
  for (let batch = 0; batch < 3; batch++) {
    const pending = bob.read(['0-0', '0-0']);
    await flush();
    redis.connections
      .at(-1)!
      .deliver([
        [
          'slogan:live:owner:alice',
          Array.from(
            { length: 100 },
            () => [`${++position}-0`, ['scope', 'account']] as [string, string[]],
          ),
        ],
      ]);
    expect(await pending).toEqual([]);
  }
  await expect(alice.read(['0-0', '0-0'])).rejects.toThrow('Stream cancelled');
  a.abort();
  b.abort();
  store.onModuleDestroy();
});
