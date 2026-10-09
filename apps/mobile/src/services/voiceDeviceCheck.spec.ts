import { probeMicrophone } from './voiceDeviceCheck';

test('checks a live unpublished input and always releases every temporary track', async () => {
  const stop = jest.fn();
  const release = jest.fn();
  const capture = jest.fn(async () => ({
    getAudioTracks: () => [{ readyState: 'live', stop }],
    getTracks: () => [{ readyState: 'live', stop }],
    release,
  }));
  expect(await probeMicrophone(capture, new AbortController().signal)).toBe('ready');
  expect(stop).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledTimes(1);
});

test('a denied permission and a missing input are different problems', async () => {
  expect(
    await probeMicrophone(async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    }, new AbortController().signal),
  ).toBe('denied');
  const stop = jest.fn();
  expect(
    await probeMicrophone(
      async () => ({
        getAudioTracks: () => [],
        getTracks: () => [{ readyState: 'ended', stop }],
      }),
      new AbortController().signal,
    ),
  ).toBe('unavailable');
  expect(stop).toHaveBeenCalledTimes(1);
});

test('a capture resolving after exit is stopped and cannot report ready', async () => {
  let resolve!: (stream: {
    getAudioTracks(): { readyState: string; stop(): void }[];
    getTracks(): { readyState: string; stop(): void }[];
  }) => void;
  const abort = new AbortController();
  const check = probeMicrophone(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
    abort.signal,
  );
  abort.abort();
  const stop = jest.fn();
  resolve({
    getAudioTracks: () => [{ readyState: 'live', stop }],
    getTracks: () => [{ readyState: 'live', stop }],
  });
  expect(await check).toBe('unavailable');
  expect(stop).toHaveBeenCalledTimes(1);
});
