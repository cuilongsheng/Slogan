const jest = import.meta.jest;
import { ConfigService } from '@nestjs/config';
import { testEnvironment } from '../fixtures/environment.js';

const send = jest.fn(async () => ({ messageId: 'fixture-message' }));
(
  jest as typeof jest & { unstable_mockModule(name: string, factory: () => unknown): void }
).unstable_mockModule('@vercel/queue', () => ({
  QueueClient: class {
    send = send;
  },
}));
const { RealtimeQueue } = await import('../../src/infrastructure/redis/realtime-queue.service.js');

const previous = process.env.VERCEL;
const previousEnvironment = process.env.VERCEL_ENV;
beforeEach(() => {
  process.env.VERCEL = '1';
  process.env.VERCEL_ENV = 'production';
  send.mockClear();
});
afterAll(() => {
  if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previousEnvironment;
  if (previous === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = previous;
});

test('managed producer publishes durable delayed jobs and deduplicates recovery seeds in a time bucket', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
  const queue = new RealtimeQueue(
    new ConfigService(testEnvironment()),
    {
      warn: jest.fn(),
    } as never,
    { send, run: (_job: unknown, work: () => Promise<void>) => work() } as never,
  );
  try {
    await queue.start(async () => undefined);
    await queue.ensureRecovery();
    await queue.ensureRecovery();
    expect(send.mock.calls[0]).not.toEqual(send.mock.calls[1]);
    await queue.enqueue({ kind: 'expiry', id: 'room' }, new Date(Date.now() + 9000));
    expect(send).toHaveBeenLastCalledWith(
      'slogan-realtime',
      { kind: 'expiry', id: 'room' },
      expect.objectContaining({ delaySeconds: 9, retentionSeconds: 604800 }),
    );
    send.mockRejectedValueOnce(new Error('queue unavailable'));
    await expect(queue.ensureRecovery(30)).rejects.toThrow('queue unavailable');
  } finally {
    await queue.onModuleDestroy();
    jest.restoreAllMocks();
  }
});

test('callback processing propagates transient failure for redelivery and rejects invalid jobs', async () => {
  const queue = new RealtimeQueue(
    new ConfigService(testEnvironment()),
    {
      warn: jest.fn(),
    } as never,
    { send, run: (_job: unknown, work: () => Promise<void>) => work() } as never,
  );
  const handler = jest.fn(async () => {
    throw new Error('temporary failure');
  });
  await queue.start(handler);
  await expect(queue.process({ kind: 'command', id: 'durable' })).rejects.toThrow(
    'temporary failure',
  );
  expect(handler).toHaveBeenCalledWith({ kind: 'command', id: 'durable' });
  await expect(queue.process({ kind: 'invalid', id: 'durable' } as never)).rejects.toThrow(
    'Invalid realtime queue job',
  );
  expect(handler).toHaveBeenCalledTimes(1);
  await queue.onModuleDestroy();
});

test('a new committed mutation gets a fresh wakeup even within the prior recovery time bucket', async () => {
  const queue = new RealtimeQueue(
    new ConfigService(testEnvironment()),
    { warn: jest.fn() } as never,
    { send, run: (_job: unknown, work: () => Promise<void>) => work() } as never,
  );
  await queue.start(async () => {});
  await queue.ensureRecovery();
  await queue.ensureRecovery();
  expect(send.mock.calls[0]).not.toEqual(send.mock.calls[1]);
  await queue.onModuleDestroy();
});
