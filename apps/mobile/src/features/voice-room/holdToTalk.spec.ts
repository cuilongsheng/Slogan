import { HoldToTalk, type HoldPorts } from './holdToTalk';
import type { PrivateClip } from '../../services/privateClip.types';
const clip = { uri: 'local', release: jest.fn() } as unknown as PrivateClip;
function setup() {
  const ports = {
    mute: jest.fn(async (): Promise<boolean> => true),
    restore: jest.fn(async () => undefined),
    start: jest.fn(async (): Promise<void> => undefined),
    stop: jest.fn(async () => clip),
    discard: jest.fn(),
    translate: jest.fn(
      async (_clip: PrivateClip, _requestId: string, _signal: AbortSignal) => 'English',
    ),
    requestId: jest.fn(() => 'same-id'),
  } satisfies HoldPorts;
  return { ports, hold: new HoldToTalk(ports) };
}
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
afterEach(() => jest.useRealTimers());
test('does not record when room mute is not confirmed', async () => {
  const { ports, hold } = setup();
  ports.mute.mockResolvedValue(false);
  hold.press();
  await flush();
  expect(ports.start).not.toHaveBeenCalled();
  expect(ports.translate).not.toHaveBeenCalled();
  expect(hold.state.phase).toBe('error');
});
test('release during pending startup stops once and restores before translating', async () => {
  const { ports, hold } = setup();
  let ready!: () => void;
  ports.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        ready = () => resolve();
      }),
  );
  hold.press();
  await flush();
  const release = hold.release();
  ready();
  await release;
  expect(ports.stop).toHaveBeenCalledTimes(1);
  expect(ports.translate).toHaveBeenCalledTimes(1);
  expect(ports.restore.mock.invocationCallOrder[0]).toBeLessThan(
    ports.translate.mock.invocationCallOrder[0]!,
  );
  expect(hold.state).toMatchObject({ phase: 'result', text: 'English' });
});
test('10 second timeout and subsequent release never duplicate upload', async () => {
  jest.useFakeTimers();
  const { ports, hold } = setup();
  hold.press();
  await flush();
  jest.advanceTimersByTime(10000);
  await flush();
  await hold.release();
  expect(ports.stop).toHaveBeenCalledTimes(1);
  expect(ports.translate).toHaveBeenCalledTimes(1);
});
test('cancel while starting waits for stop and does not upload', async () => {
  const { ports, hold } = setup();
  let ready!: () => void;
  ports.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        ready = () => resolve();
      }),
  );
  hold.press();
  await flush();
  const cancel = hold.cancel();
  ready();
  await cancel;
  expect(ports.stop).toHaveBeenCalledTimes(1);
  expect(ports.translate).not.toHaveBeenCalled();
  expect(ports.restore).toHaveBeenCalledTimes(1);
});
test('translation retry reuses the stopped clip and request identifier', async () => {
  const { ports, hold } = setup();
  ports.translate.mockRejectedValueOnce(new Error('network'));
  hold.press();
  await flush();
  await hold.release();
  expect(hold.state.phase).toBe('error');
  await hold.retry();
  expect(ports.translate.mock.calls.map(([clip, id]) => [clip, id])).toEqual([
    [clip, 'same-id'],
    [clip, 'same-id'],
  ]);
});
test('failed stop never reopens the room microphone', async () => {
  const { ports, hold } = setup();
  ports.stop.mockRejectedValueOnce(new Error('stop failed'));
  hold.press();
  await flush();
  await hold.release();
  expect(ports.restore).not.toHaveBeenCalled();
  expect(ports.translate).not.toHaveBeenCalled();
  hold.press();
  await flush();
  expect(ports.start).toHaveBeenCalledTimes(1);
});

test('closing while translation waits aborts the request and cannot show a stale result', async () => {
  const { ports, hold } = setup();
  let signal: AbortSignal | undefined;
  ports.translate.mockImplementationOnce((_clip, _id, abort) => {
    signal = abort;
    return new Promise<string>((_resolve, reject) => {
      abort.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    });
  });
  hold.press();
  await flush();
  const release = hold.release();
  await flush();
  expect(hold.state.phase).toBe('translating');
  await hold.cancel();
  await release;
  expect(signal?.aborted).toBe(true);
  expect(hold.state).toMatchObject({ phase: 'idle', text: null });
  expect(ports.restore).toHaveBeenCalledTimes(1);
});

test('retry is exclusive and cancellation cannot resurrect its error state', async () => {
  const { ports, hold } = setup();
  ports.translate.mockRejectedValueOnce(new Error('response lost'));
  hold.press();
  await flush();
  await hold.release();
  ports.translate.mockImplementationOnce(
    (_clip, _id, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
      }),
  );
  const retry = hold.retry();
  await flush();
  await hold.retry();
  expect(ports.translate).toHaveBeenCalledTimes(2);
  await hold.cancel();
  await retry;
  expect(hold.state).toMatchObject({ phase: 'idle', error: null, text: null });
});
