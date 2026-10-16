const mockGet = jest.fn();
jest.mock('@slogan/api-client', () => ({ createSloganApiClient: () => ({ GET: mockGet }) }));
jest.mock('../../services/streamFetch', () => ({ streamFetch: jest.fn() }));
import { receiveLiveUpdates } from './api';
import type { useAuth } from '../auth';
const authorized = ((request: (token: string) => Promise<unknown>) =>
  request('fixture')) as ReturnType<typeof useAuth>['authorized'];
beforeEach(() => {
  jest.useFakeTimers();
  mockGet.mockReset();
});
afterEach(() => jest.useRealTimers());
function stalledBody() {
  let finish: (result: { done: true }) => void = () => {};
  const reader = {
    read: jest.fn(
      () =>
        new Promise<{ done: true }>((resolve) => {
          finish = resolve;
        }),
    ),
    cancel: jest.fn(async () => {
      finish({ done: true });
    }),
    releaseLock: jest.fn(),
  };
  mockGet.mockResolvedValue({
    response: { ok: true, headers: new Headers({ 'content-type': 'text/event-stream' }) },
    data: { getReader: () => reader },
  });
  return reader;
}
test('watchdog aborts the underlying native request before reconnect, not just the body reader', async () => {
  const reader = stalledBody();
  const parent = new AbortController();
  const run = receiveLiveUpdates(authorized, parent.signal, undefined, jest.fn());
  await Promise.resolve();
  await Promise.resolve();
  const transport = mockGet.mock.calls[0][1].signal as AbortSignal;
  expect(transport.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(30000);
  await run;
  expect(transport.aborted).toBe(true);
  expect(parent.signal.aborted).toBe(false);
  expect(reader.cancel).toHaveBeenCalled();
  expect(reader.releaseLock).toHaveBeenCalledTimes(1);
});
test('background cancellation aborts the HTTP request and releases its reader', async () => {
  const reader = stalledBody();
  const parent = new AbortController();
  const run = receiveLiveUpdates(authorized, parent.signal, undefined, jest.fn());
  await Promise.resolve();
  await Promise.resolve();
  parent.abort();
  await run;
  expect(mockGet.mock.calls[0][1].signal.aborted).toBe(true);
  expect(reader.releaseLock).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
test('cancellation also covers a request still waiting for response headers', async () => {
  mockGet.mockImplementation(
    (_path, options: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('Aborted')), {
          once: true,
        });
      }),
  );
  const parent = new AbortController();
  const run = receiveLiveUpdates(authorized, parent.signal, undefined, jest.fn());
  const rejection = expect(run).rejects.toThrow('Aborted');
  parent.abort();
  await rejection;
  expect(mockGet.mock.calls[0][1].signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
