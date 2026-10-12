import { RoomApiError } from '../room-discovery/api';
import { RoomExitQueue } from './exitQueue';

const intent = { roomId: 'room-1', action: 'leave' as const, expectedCredentialVersion: 3 };
const tick = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
function fixture() {
  let value: string | null = null;
  const storage = {
    get: jest.fn(async () => value),
    set: jest.fn(async (_key: string, next: string) => {
      value = next;
    }),
  };
  const api = {
    leave: jest.fn(async () => ({ lifecycle: 'LEFT', roomStatus: 'OPEN' })),
    end: jest.fn(async () => ({ roomStatus: 'ENDING' })),
  };
  const changed = jest.fn();
  const queue = new RoomExitQueue('actor-a', api as never, storage, changed);
  return { queue, api, storage, changed, value: () => value };
}
afterEach(() => jest.useRealTimers());
it('returns from enqueue immediately and persists before a deferred request', async () => {
  const { queue, api, storage, value } = fixture();
  let finish!: (result: { lifecycle: string; roomStatus: string }) => void;
  api.leave.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  expect(queue.enqueue(intent)).toBeUndefined();
  expect(queue.pendingRoomIds).toEqual(['room-1']);
  await tick();
  expect(JSON.parse(value()!)).toEqual([intent]);
  expect(storage.set.mock.invocationCallOrder[0]).toBeLessThan(
    api.leave.mock.invocationCallOrder[0]!,
  );
  finish({ lifecycle: 'LEFT', roomStatus: 'OPEN' });
  await tick();
  expect(queue.pendingRoomIds).toEqual([]);
  expect(value()).toBe('[]');
  queue.stop();
});
it('recovers an uncertain response for the same actor and membership generation after restart', async () => {
  jest.useFakeTimers();
  const { queue, api, storage, changed } = fixture();
  api.leave.mockRejectedValueOnce(new Error('offline'));
  queue.enqueue(intent);
  await queue.flush();
  expect(changed).toHaveBeenLastCalledWith(true);
  queue.stop();
  const recovered = new RoomExitQueue('actor-a', api as never, storage, changed);
  await recovered.flush();
  expect(api.leave).toHaveBeenLastCalledWith('room-1', 3, undefined);
  expect(storage.get).toHaveBeenLastCalledWith('slogan.roomExits.actor-a');
  expect(recovered.pendingRoomIds).toEqual([]);
  recovered.stop();
});
it('stopped delivery never retries on the next account', async () => {
  jest.useFakeTimers();
  const { queue, api } = fixture();
  api.leave.mockRejectedValue(new Error('offline'));
  queue.enqueue(intent);
  await queue.flush();
  queue.stop();
  await jest.advanceTimersByTimeAsync(60_000);
  await queue.flush();
  expect(api.leave).toHaveBeenCalledTimes(1);
});
it('does not overwrite unread persistent intent or call the API after storage failure', async () => {
  jest.useFakeTimers();
  const { queue, api, storage, changed } = fixture();
  storage.get.mockRejectedValueOnce(new Error('storage locked'));
  queue.enqueue(intent);
  await queue.flush();
  expect(storage.set).not.toHaveBeenCalled();
  expect(api.leave).not.toHaveBeenCalled();
  expect(changed).toHaveBeenLastCalledWith(true);
  await queue.flush();
  expect(api.leave).toHaveBeenCalledWith('room-1', 3, undefined);
  queue.stop();
});
it('retries an obsolete successor with the server joining-order policy', async () => {
  jest.useFakeTimers();
  const { queue, api } = fixture();
  api.leave.mockRejectedValueOnce(new RoomApiError(400, 'ROOM_SUCCESSOR_INVALID'));
  queue.enqueue({ ...intent, successorMembershipId: 'old-successor' });
  await queue.flush();
  await queue.flush();
  expect(api.leave).toHaveBeenLastCalledWith('room-1', 3, undefined);
  expect(queue.pendingRoomIds).toEqual([]);
  queue.stop();
});
