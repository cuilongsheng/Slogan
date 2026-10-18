const jest = import.meta.jest;
import { ConfigService } from '@nestjs/config';
import { testEnvironment } from '../fixtures/environment.js';

const send = jest.fn(async (..._args: unknown[]) => ({ messageId: 'fixture' }));
(
  jest as typeof jest & { unstable_mockModule(name: string, factory: () => unknown): void }
).unstable_mockModule('@vercel/queue', () => ({
  QueueClient: class {
    send = send;
  },
}));
const { MaintenanceService } = await import('../../src/modules/maintenance/maintenance.service.js');
const prior = { vercel: process.env.VERCEL, environment: process.env.VERCEL_ENV };
beforeEach(() => {
  process.env.VERCEL = '1';
  process.env.VERCEL_ENV = 'production';
  send.mockReset().mockResolvedValue({ messageId: 'fixture' });
});
afterAll(() => {
  if (prior.vercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = prior.vercel;
  if (prior.environment === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = prior.environment;
});
function setup() {
  let release!: () => void;
  const direct = {
    maintain: jest.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    ),
  };
  const safety = { recover: jest.fn(async () => {}) };
  const operations = { runOnce: jest.fn(async () => {}) };
  const realtime = { ensureRecovery: jest.fn(async () => {}) };
  const leases = {
    claim: jest.fn(async () => ({ key: 'managed-maintenance', leaseId: 'lease', generation: 1 })),
    finish: jest.fn(async () => {}),
  };
  const live = {
    recover: jest.fn(async () => {}),
    reconcileRelease: jest.fn(async () => {}),
    expirePresence: jest.fn(async () => 0),
    sweepPresence: jest.fn(async () => false),
  };
  const hints = {
    read: jest.fn(async () => ({ outbox: true, realtime: true, direct: true, safety: true })),
  };
  const service = new MaintenanceService(
    direct as never,
    safety as never,
    operations as never,
    {} as never,
    realtime as never,
    leases as never,
    new ConfigService(testEnvironment({ ASSISTANCE_ENABLED: false })),
    { warn: jest.fn() } as never,
    live as never,
    { run: (_job: unknown, work: () => Promise<void>) => work(), send } as never,
    hints as never,
  );
  return {
    service,
    direct,
    safety,
    operations,
    realtime,
    leases,
    live,
    hints,
    release: () => release(),
  };
}

test('overlapping maintenance shares work and continuation without swallowing per-owner expiry', async () => {
  const f = setup();
  const deliveries = Array.from({ length: 100 }, () => f.service.process({ kind: 'maintenance' }));
  // Let the publish and lease acquisition enter the held business scan.
  await new Promise<void>((resolve) => setImmediate(resolve));
  await f.service.process({
    kind: 'presence-expiry',
    userId: 'a'.repeat(36),
    generation: 'b'.repeat(36),
  });
  expect(f.live.expirePresence).toHaveBeenCalledTimes(1);
  f.release();
  await Promise.all(deliveries);
  expect(send).toHaveBeenCalledTimes(2);
  expect(f.leases.claim).toHaveBeenCalledTimes(1);
  expect(f.direct.maintain).toHaveBeenCalledTimes(1);
  expect(f.safety.recover).toHaveBeenCalledTimes(1);
  expect(f.realtime.ensureRecovery).toHaveBeenCalledTimes(1);
  expect(f.live.recover).toHaveBeenCalledTimes(2);
  expect(f.leases.finish).toHaveBeenCalledWith(expect.anything(), true);
});

test('continuation failures propagate to all deliveries, then a fresh delivery retries', async () => {
  const f = setup();
  f.leases.claim.mockRejectedValueOnce(new Error('database unavailable'));
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => f.service.process({ kind: 'maintenance' })),
  );
  expect(results.every((result) => result.status === 'rejected')).toBe(true);
  expect(f.direct.maintain).not.toHaveBeenCalled();
  const retry = f.service.process({ kind: 'maintenance' });
  await new Promise<void>((resolve) => setImmediate(resolve));
  f.release();
  await retry;
  expect(send).toHaveBeenCalledTimes(3);
  expect(f.leases.finish).toHaveBeenCalledWith(expect.anything(), true);
});

test('Preview can execute a fenced owner job without an in-process timer', async () => {
  process.env.VERCEL_ENV = 'preview';
  const f = setup();
  const work = f.service.process({ kind: 'maintenance' });
  await new Promise<void>((resolve) => setImmediate(resolve));
  f.release();
  await work;
  expect(f.direct.maintain).toHaveBeenCalledTimes(1);
});

test('empty fallback performs only hints and the low-frequency presence sweep', async () => {
  const f = setup();
  f.hints.read.mockResolvedValue({ outbox: false, realtime: false, direct: false, safety: false });
  await f.service.process({ kind: 'fallback' });
  expect(f.hints.read).toHaveBeenCalledTimes(1);
  expect(f.leases.claim).not.toHaveBeenCalled();
  expect(f.direct.maintain).not.toHaveBeenCalled();
  expect(f.realtime.ensureRecovery).not.toHaveBeenCalled();
  expect(f.live.recover).not.toHaveBeenCalled();
  expect(f.live.sweepPresence).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(
    'slogan-maintenance',
    { kind: 'fallback' },
    expect.objectContaining({ delaySeconds: expect.any(Number) }),
    true,
  );
});

test('duplicate online expiry deliveries publish the same expiry-scoped continuation key', async () => {
  const f = setup();
  f.live.expirePresence.mockResolvedValue(45000);
  await f.service.process({
    kind: 'presence-expiry',
    userId: 'a'.repeat(36),
    generation: 'b'.repeat(36),
  });
  await f.service.process({
    kind: 'presence-expiry',
    userId: 'a'.repeat(36),
    generation: 'b'.repeat(36),
  });
  expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
  expect(send).toHaveBeenCalledWith(
    'slogan-maintenance',
    expect.anything(),
    expect.objectContaining({ idempotencyKey: expect.stringContaining('presence-') }),
  );
});

const emptyHints = { outbox: false, realtime: false, direct: false, safety: false };
test('idle hourly fallback and online quarter-hour fallback converge on the same boundary key', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 18, 12, 1));
  try {
    const f = setup();
    f.hints.read.mockResolvedValue(emptyHints);
    await f.service.process({ kind: 'fallback' });
    expect(send).toHaveBeenLastCalledWith(
      'slogan-maintenance',
      { kind: 'fallback' },
      expect.objectContaining({ delaySeconds: 3540 }),
      true,
    );
    f.live.sweepPresence.mockResolvedValue(true);
    await f.service.process({ kind: 'fallback' });
    expect(send).toHaveBeenLastCalledWith(
      'slogan-maintenance',
      { kind: 'fallback' },
      expect.objectContaining({ delaySeconds: 840 }),
      true,
    );
    now.mockReturnValue(Date.UTC(2026, 9, 18, 12, 46));
    await f.service.process({ kind: 'fallback' });
    expect(send.mock.calls[0]![2]).toEqual(
      expect.objectContaining({
        idempotencyKey: (send.mock.calls[2]![2] as { idempotencyKey: string }).idempotencyKey,
      }),
    );
    f.live.sweepPresence.mockResolvedValue(false);
    now.mockReturnValue(Date.UTC(2026, 9, 18, 13, 0));
    await f.service.process({ kind: 'fallback' });
    expect(send).toHaveBeenLastCalledWith(
      'slogan-maintenance',
      { kind: 'fallback' },
      expect.objectContaining({ delaySeconds: 3600 }),
      true,
    );
  } finally {
    now.mockRestore();
  }
});
test('first live expiry restores short fallback once; later expiries do not create extra chains', async () => {
  const f = setup();
  f.live.expirePresence.mockResolvedValue(45000);
  const job = {
    kind: 'presence-expiry',
    userId: 'a'.repeat(36),
    generation: 'b'.repeat(36),
    activateFallback: true,
  };
  await f.service.process(job);
  expect(send).toHaveBeenCalledTimes(2);
  const continuation = send.mock.calls[1]![1] as typeof job;
  expect(continuation.activateFallback).toBe(false);
  await f.service.process(continuation);
  expect(send).toHaveBeenCalledTimes(3);
});
test('business work restores short safety fallback before recovery; empty mutation does not wake it', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 18, 12, 1));
  try {
    const f = setup();
    f.hints.read.mockResolvedValue(emptyHints);
    await f.service.process({ kind: 'maintenance' });
    expect(send).not.toHaveBeenCalled();
    f.hints.read.mockResolvedValue({ ...emptyHints, outbox: true });
    await f.service.process({ kind: 'maintenance' });
    expect(send).toHaveBeenCalledWith(
      'slogan-maintenance',
      { kind: 'fallback' },
      expect.objectContaining({ delaySeconds: 840 }),
      true,
    );
    expect(f.live.recover).toHaveBeenCalled();
  } finally {
    now.mockRestore();
  }
});
