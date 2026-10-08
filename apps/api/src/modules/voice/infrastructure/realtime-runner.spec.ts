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
  const runner = new RealtimeRunner(
    new ConfigService(testEnvironment({ REALTIME_ENABLED: mediaEnabled })),
    queue as never,
    rooms as never,
    voice as never,
    { warn: jest.fn() } as never,
  );
  return { runner, queue, rooms, voice, consume: (job: RealtimeJob) => consume!(job) };
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
  expect(queue.ensureRecovery).toHaveBeenLastCalledWith(30);
  await consume({ kind: 'recovery', id: 'scan' });
  expect(queue.enqueue).toHaveBeenCalledTimes(2);
  expect(rooms.pendingCommands).toHaveBeenCalledTimes(4);
  expect(queue.enqueue).toHaveBeenLastCalledWith({ kind: 'command', id: 'durable-command' });
});
test('a database or next-scan failure propagates so the managed queue retries the delivery', async () => {
  const { runner, queue, rooms, consume } = setup();
  await runner.onModuleInit();
  rooms.pendingCommands.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(consume({ kind: 'recovery', id: 'scan' })).rejects.toThrow('database unavailable');
  expect(queue.ensureRecovery).not.toHaveBeenCalled();
  queue.ensureRecovery.mockRejectedValueOnce(new Error('publish failed'));
  await expect(consume({ kind: 'recovery', id: 'scan' })).rejects.toThrow('publish failed');
});
test('retention cleanup still scans when media processing is disabled', async () => {
  const { runner, rooms, voice, consume } = setup(false);
  await runner.onModuleInit();
  await consume({ kind: 'recovery', id: 'scan' });
  expect(rooms.pendingCommands).toHaveBeenCalled();
  expect(voice.dispatch).not.toHaveBeenCalled();
});
