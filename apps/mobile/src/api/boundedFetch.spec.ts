import { boundedFetch } from './boundedFetch';

describe('bounded API transport', () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    jest.useRealTimers();
  });

  it('preserves error status, headers and response bodies', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response('{"code":"DENIED"}', {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
      }),
    );
    const response = await boundedFetch('https://example.invalid');
    expect(response.status).toBe(403);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(await response.json()).toEqual({ code: 'DENIED' });
  });

  it('bounds stalls while reading the response body and propagates caller cancellation', async () => {
    jest.useFakeTimers();
    globalThis.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve({
        arrayBuffer: () =>
          new Promise<ArrayBuffer>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), {
              once: true,
            });
          }),
      } as Response),
    );
    const pending = boundedFetch('https://example.invalid');
    const rejected = expect(pending).rejects.toThrow('Aborted');
    await jest.advanceTimersByTimeAsync(30_000);
    await rejected;
    const controller = new AbortController();
    const cancelled = boundedFetch('https://example.invalid', { signal: controller.signal });
    const cancellation = expect(cancelled).rejects.toThrow('Aborted');
    await Promise.resolve();
    controller.abort();
    await cancellation;
    expect(jest.getTimerCount()).toBe(0);
  });
});
