const jest = import.meta.jest;
const send = jest.fn(async () => ({}));
(
  jest as typeof jest & { unstable_mockModule(name: string, factory: () => unknown): void }
).unstable_mockModule('@vercel/queue', () => ({
  QueueClient: class {
    send = send;
  },
}));
const { WorkerOwner } = await import('../../src/infrastructure/managed/worker-owner.service.js');
const previous = { vercel: process.env.VERCEL, deployment: process.env.VERCEL_DEPLOYMENT_ID };
beforeEach(() => {
  process.env.VERCEL = '1';
  process.env.VERCEL_DEPLOYMENT_ID = 'dpl_new';
  send.mockClear();
});
afterAll(() => {
  for (const [key, value] of Object.entries({
    VERCEL: previous.vercel,
    VERCEL_DEPLOYMENT_ID: previous.deployment,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
function setup() {
  let owner = { deploymentId: 'dpl_new', generation: 2 };
  const read = jest.fn(async () => owner);
  const service = new WorkerOwner({ managedWorkerOwner: { findUnique: read } } as never);
  return {
    service,
    read,
    replace: () => {
      owner = { deploymentId: 'dpl_next', generation: 3 };
    },
  };
}
test('wrong deployment and legacy deliveries do not read DB or execute recovery', async () => {
  const f = setup(),
    work = jest.fn(async () => {});
  await f.service.run({}, work);
  await f.service.run({ owner: { deploymentId: 'dpl_old', generation: 1 } }, work);
  expect(f.read).not.toHaveBeenCalled();
  expect(work).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
test('obsolete generation on the same deployment is a single fence read and no recovery', async () => {
  const f = setup(),
    work = jest.fn(async () => {});
  await f.service.run({ owner: { deploymentId: 'dpl_new', generation: 1 } }, work);
  expect(f.read).toHaveBeenCalledTimes(1);
  expect(work).not.toHaveBeenCalled();
});
test('already claimed work can finish but cannot send after activation changes', async () => {
  const f = setup();
  await f.service.run({ owner: { deploymentId: 'dpl_new', generation: 2 } }, async () => {
    f.replace();
    expect(await f.service.send('slogan-maintenance', { kind: 'maintenance' })).toBe(false);
  });
  expect(send).not.toHaveBeenCalled();
});
test('business wakeups route to the active owner with a generation-scoped idempotency key', async () => {
  const f = setup();
  await f.service.send(
    'slogan-realtime',
    { kind: 'command', id: 'one' },
    { idempotencyKey: 'one' },
  );
  expect(send).toHaveBeenCalledWith(
    'slogan-realtime',
    { kind: 'command', id: 'one', owner: { deploymentId: 'dpl_new', generation: 2 } },
    { idempotencyKey: 'g2-one' },
  );
});
