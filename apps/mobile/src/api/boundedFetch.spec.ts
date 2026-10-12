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

  it('preserves UTF-8 room titles, member names and emoji through native JSON transport', async () => {
    const testRequire = require as unknown as {
      resolve(id: string, options?: { paths: string[] }): string;
    };
    const native = jest.requireActual(
      testRequire.resolve('whatwg-fetch', {
        paths: [testRequire.resolve('react-native/package.json')],
      }),
    );
    const originalResponse = globalThis.Response;
    globalThis.Response = native.Response;
    const payload = { topic: '测试房间 · Travel 🌏', displayName: '崔龙生' };
    const text = JSON.stringify(payload);
    const utf8Bytes = encodeURIComponent(text).replace(/%([A-F0-9]{2})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
    globalThis.fetch = jest.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new native.Headers({ 'Content-Type': 'application/json' }),
      text: async () => text,
      arrayBuffer: async () =>
        Uint8Array.from(utf8Bytes, (character) => character.charCodeAt(0)).buffer,
    });
    try {
      const response = await boundedFetch('https://example.invalid/v1/rooms');
      expect(await response.json()).toEqual(payload);
    } finally {
      globalThis.Response = originalResponse;
    }
  });

  it('bounds stalls while reading the response body and propagates caller cancellation', async () => {
    jest.useFakeTimers();
    globalThis.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve({
        text: () =>
          new Promise<string>((_resolve, reject) => {
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
