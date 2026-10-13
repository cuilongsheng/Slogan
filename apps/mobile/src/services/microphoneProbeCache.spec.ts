import { MicrophoneProbeCache } from './microphoneProbeCache';

test('reuses a successful probe only with a fresh granted permission and within five minutes', async () => {
  let now = 1000;
  const cache = new MicrophoneProbeCache(() => now);
  const probe = jest.fn(async () => 'ready' as const);
  const signal = new AbortController().signal;
  await cache.check(true, false, signal, probe);
  await cache.check(true, false, signal, probe);
  expect(probe).toHaveBeenCalledTimes(1);
  now += 300_000;
  await cache.check(true, false, signal, probe);
  expect(probe).toHaveBeenCalledTimes(2);
  await cache.check(false, false, signal, probe);
  await cache.check(true, true, signal, probe);
  expect(probe).toHaveBeenCalledTimes(4);
});

test('an aborted or invalidated probe cannot certify a later room', async () => {
  const cache = new MicrophoneProbeCache();
  const abort = new AbortController();
  let finish!: (value: 'ready') => void;
  const checking = cache.check(
    true,
    false,
    abort.signal,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  cache.invalidate();
  abort.abort();
  finish('ready');
  expect(await checking).toBe('unavailable');
  const next = jest.fn(async () => 'ready' as const);
  await cache.check(true, false, new AbortController().signal, next);
  expect(next).toHaveBeenCalledTimes(1);
});
