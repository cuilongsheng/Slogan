const jest = import.meta.jest;
const send = jest.fn(async (..._args: unknown[]) => ({ messageId: 'fixture' }));
(
  jest as typeof jest & { unstable_mockModule(name: string, factory: () => unknown): void }
).unstable_mockModule('@vercel/queue', () => ({
  QueueClient: class {
    send = send;
  },
}));
const { maintenanceSeed } = await import('../../api/maintenance-seed.js');
const seed = maintenanceSeed(async () => ({ send }) as never);
const original = { ...process.env };
beforeEach(() => {
  send.mockClear();
  process.env.VERCEL_ENV = 'production';
  process.env.CRON_SECRET = 'fixture-only-cron-secret';
  process.env.OBSERVABILITY_MONITOR_ENABLED = 'true';
  process.env.OBSERVABILITY_MONITOR_INTERVAL_SECONDS = '60';
});
afterEach(() => {
  process.env = { ...original };
  jest.restoreAllMocks();
});
async function invoke(authorized = true) {
  let status = 0;
  const response = {
    writeHead: jest.fn((value: number) => {
      status = value;
      return { end: jest.fn() };
    }),
    end: jest.fn(),
  };
  await seed(
    {
      method: 'GET',
      headers: { authorization: authorized ? 'Bearer fixture-only-cron-secret' : 'Bearer invalid' },
    } as never,
    response as never,
  );
  return status;
}
test('unauthorized seed never publishes either private topic', async () => {
  expect(await invoke(false)).toBe(401);
  expect(send).not.toHaveBeenCalled();
});
test('monitor reseed shares the scheduler window key while retaining maintenance', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(1_800_000);
  expect(await invoke()).toBe(200);
  expect(await invoke()).toBe(200);
  expect(send).toHaveBeenCalledWith(
    'slogan-observability',
    { kind: 'monitor', window: 2 },
    {
      retentionSeconds: 604800,
      idempotencyKey: 'monitor-production-900-2',
    },
    true,
  );
  expect(send.mock.calls.filter(([topic]) => topic === 'slogan-maintenance')).toHaveLength(2);
});
test('disabled monitoring does not publish its topic', async () => {
  process.env.OBSERVABILITY_MONITOR_ENABLED = 'false';
  expect(await invoke()).toBe(200);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]?.[0]).toBe('slogan-maintenance');
});
test('failed monitor publication returns failure without exposing provider output', async () => {
  send
    .mockResolvedValueOnce({ messageId: 'fixture' })
    .mockRejectedValueOnce(new Error('PRIVATE_CANARY'));
  expect(await invoke()).toBe(503);
});
