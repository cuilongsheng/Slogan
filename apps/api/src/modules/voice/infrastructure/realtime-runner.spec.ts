const jest = import.meta.jest;
import { ConfigService } from '@nestjs/config';
import type { RealtimeJob } from '../../../infrastructure/redis/realtime-queue.service.js';
import { RealtimeRunner } from './realtime-runner.service.js';
import { testEnvironment } from '../../../../test/fixtures/environment.js';

function setup(mediaEnabled = true) {
  let consume: ((job: RealtimeJob) => Promise<void>) | undefined;
  const queue = {
    managed: true,
    start: async (handler: typeof consume) => {
      consume = handler;
    },
    enqueue: jest.fn(async () => undefined),
    ensureRecovery: jest.fn(async () => undefined),
  };
  const rooms = {
    recoverableRooms: jest.fn(async () => []),
    pendingCommands: jest.fn(async () => ['durable-command']),
    scheduledHostTimeouts: jest.fn(async () => []),
    settleAppointment: jest.fn(async () => undefined),
  };
  const voice = {
    dispatch: jest.fn(async () => undefined),
    expire: jest.fn(async () => undefined),
    reconcile: jest.fn(async () => undefined),
  };
  const heartbeat = { completed: jest.fn(async () => undefined) };
  const runner = new RealtimeRunner(
    new ConfigService(testEnvironment({ REALTIME_ENABLED: mediaEnabled })),
    queue as never,
    rooms as never,
    voice as never,
    { warn: jest.fn() } as never,
    heartbeat as never,
  );
  return { runner, queue, rooms, voice, heartbeat, consume: (job: RealtimeJob) => consume!(job) };
}
test('managed mode has no in-process timer; delivery runs cleanup independently of a request', async () => {
  const { runner, rooms, voice, consume } = setup();
  await runner.onModuleInit();
  expect(rooms.pendingCommands).not.toHaveBeenCalled();
  await consume({ kind: 'command', id: 'durable-command' });
  expect(voice.dispatch).toHaveBeenCalledWith('durable-command');
  await runner.onModuleDestroy();
});
test('recovery rescans durable commands after a failed publish and schedules the next scan', async () => {
  const { runner, queue, consume, rooms } = setup();
  await runner.onModuleInit();
  queue.enqueue.mockRejectedValueOnce(new Error('queue unavailable'));
  await consume({ kind: 'recovery', id: 'scan' });
  expect(queue.ensureRecovery).not.toHaveBeenCalled();
  await consume({ kind: 'recovery', id: 'scan' });
  expect(queue.enqueue).toHaveBeenCalledTimes(2);
  expect(rooms.pendingCommands).toHaveBeenCalledTimes(2);
  expect(queue.enqueue).toHaveBeenLastCalledWith({ kind: 'command', id: 'durable-command' });
});
test('a database or next-scan failure propagates so the managed queue retries the delivery', async () => {
  const { runner, queue, rooms, consume } = setup();
  await runner.onModuleInit();
  rooms.pendingCommands.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(consume({ kind: 'recovery', id: 'scan' })).rejects.toThrow('database unavailable');
  expect(queue.ensureRecovery).not.toHaveBeenCalled();
  await consume({ kind: 'recovery', id: 'scan' });
  expect(queue.ensureRecovery).not.toHaveBeenCalled();
});
test('retention cleanup still scans when media processing is disabled', async () => {
  const { runner, rooms, voice, consume } = setup(false);
  await runner.onModuleInit();
  await consume({ kind: 'recovery', id: 'scan' });
  expect(rooms.pendingCommands).toHaveBeenCalled();
  expect(voice.dispatch).not.toHaveBeenCalled();
});

test('managed heartbeat follows successful recovery and continuation only', async () => {
  const { runner, rooms, heartbeat, consume } = setup();
  await runner.onModuleInit();
  rooms.pendingCommands.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(consume({ kind: 'recovery', id: 'scan' })).rejects.toThrow();
  expect(heartbeat.completed).not.toHaveBeenCalled();

  await consume({ kind: 'recovery', id: 'scan' });
  expect(heartbeat.completed).toHaveBeenCalledWith('realtime');
});

test('one hundred overlapping recovery deliveries share one scan and continuation', async () => {
  const { runner, queue, rooms, heartbeat, consume } = setup();
  let release!: () => void;
  rooms.recoverableRooms.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = () => resolve([]);
      }),
  );
  await runner.onModuleInit();
  const deliveries = Array.from({ length: 100 }, () => consume({ kind: 'recovery', id: 'scan' }));
  // Ordinary commands must not be swallowed by the recovery coalescer.
  await consume({ kind: 'command', id: 'another-command' });
  release();
  await Promise.all(deliveries);
  expect(rooms.recoverableRooms).toHaveBeenCalledTimes(1);
  expect(rooms.pendingCommands).toHaveBeenCalledTimes(1);
  expect(rooms.scheduledHostTimeouts).toHaveBeenCalledTimes(1);
  expect(queue.ensureRecovery).not.toHaveBeenCalled();
  expect(queue.ensureRecovery).not.toHaveBeenCalled();
  expect(heartbeat.completed).toHaveBeenCalledTimes(1);
  await consume({ kind: 'recovery', id: 'scan' });
  expect(rooms.pendingCommands).toHaveBeenCalledTimes(2);
});

test('overlapping failures all retry, and an idle retry schedules the existing five-minute interval', async () => {
  const { runner, queue, rooms, consume } = setup();
  await runner.onModuleInit();
  rooms.pendingCommands.mockRejectedValueOnce(new Error('shared failure'));
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => consume({ kind: 'recovery', id: 'scan' })),
  );
  expect(results.every((result) => result.status === 'rejected')).toBe(true);
  expect(rooms.pendingCommands).toHaveBeenCalledTimes(1);
  expect(queue.ensureRecovery).not.toHaveBeenCalled();
  rooms.pendingCommands.mockResolvedValueOnce([]);
  await consume({ kind: 'recovery', id: 'scan' });
  expect(queue.ensureRecovery).not.toHaveBeenCalled();
});

test('appointment settlement refreshes the room snapshot before reconciling media', async () => {
  const { runner, rooms, voice, queue, consume } = setup();
  rooms.recoverableRooms
    .mockResolvedValueOnce([
      {
        id: 'appointment',
        kind: 'APPOINTMENT',
        status: 'SCHEDULED',
        startedAt: new Date(Date.now() - 1000),
        initialHostDeadline: new Date(Date.now() - 1000),
      },
    ] as never)
    .mockResolvedValueOnce([
      {
        id: 'appointment',
        kind: 'APPOINTMENT',
        status: 'OPEN',
        endsAt: new Date(Date.now() + 60000),
      },
    ] as never);
  await runner.onModuleInit();
  await consume({ kind: 'recovery', id: 'scan' });
  expect(rooms.settleAppointment).toHaveBeenCalledWith('appointment');
  expect(rooms.recoverableRooms).toHaveBeenCalledTimes(2);
  expect(voice.reconcile).toHaveBeenCalledWith('appointment');
  expect(queue.ensureRecovery).not.toHaveBeenCalled();
});

test('a recovery arriving during a scan gets a fresh pass before acknowledgement', async () => {
  const { runner, queue, rooms, consume } = setup();
  let release!: () => void;
  rooms.recoverableRooms.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = () => resolve([]);
      }),
  );
  rooms.pendingCommands.mockResolvedValue([]);
  await runner.onModuleInit();
  const first = consume({ kind: 'recovery', id: 'scan' });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const later = consume({ kind: 'recovery', id: 'scan' });
  release();
  await Promise.all([first, later]);
  expect(rooms.recoverableRooms).toHaveBeenCalledTimes(2);
  expect(queue.ensureRecovery).not.toHaveBeenCalled();
});
