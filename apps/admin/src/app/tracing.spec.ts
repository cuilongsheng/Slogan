import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureAdminTracing,
  rememberAdminRequest,
  traceAdminFetch,
  clearAdminTraceContext,
} from './tracing';
const trace = `${'a'.repeat(32)}-${'b'.repeat(16)}-1`;
const span = { setAttribute: vi.fn(), setStatus: vi.fn() };
function sdk(mode = 'normal') {
  return {
    startSpan: async (
      _options: unknown,
      execute: (currentSpan: typeof span) => Promise<Response>,
    ) => {
      if (mode === 'before') throw new Error('SDK failure');
      const response = await execute(span);
      if (mode === 'after') throw new Error('SDK failure');
      return response;
    },
    getTraceData: () => ({
      'sentry-trace': trace,
      baggage: 'sentry-org_id=123,user=PRIVATE_CANARY',
    }),
  };
}
afterEach(() => clearAdminTraceContext());
describe('manual API tracing', () => {
  it('uses the schema template, propagates only technical context and refuses redirects', async () => {
    configureAdminTracing(sdk() as never);
    const request = new Request(
      'https://api.example.test/v1/rooms/PRIVATE_CANARY?secret=PRIVATE_CANARY',
      { headers: { baggage: 'PRIVATE_CANARY' } },
    );
    rememberAdminRequest(request, '/v1/rooms/{roomId}');
    const response = new Response('', { status: 200 });
    const execute = vi.fn(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('sentry-trace')).toBe(trace);
      expect(headers.get('baggage')).toBe('sentry-org_id=123');
      expect(init?.redirect).toBe('error');
      return response;
    });
    expect(await traceAdminFetch(request, undefined, execute, 'https://api.example.test')).toBe(
      response,
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(span.setAttribute).toHaveBeenCalledWith('http.response.status_code', 200);
  });
  it('does not attach telemetry to another origin or a non-contract path', async () => {
    configureAdminTracing(sdk() as never);
    for (const destination of ['https://other.test/v1/me', 'https://api.example.test/oauth']) {
      const request = new Request(destination);
      rememberAdminRequest(request, '/v1/me');
      const execute = vi.fn(async (input, init) => {
        expect(input).toBe(request);
        expect(init).toBeUndefined();
        return new Response('');
      });
      await traceAdminFetch(request, undefined, execute, 'https://api.example.test');
    }
  });
  it.each(['before', 'after'])(
    'never repeats a mutation when telemetry fails %s execution',
    async (mode) => {
      configureAdminTracing(sdk(mode) as never);
      const request = new Request('https://api.example.test/v1/rooms', {
        method: 'POST',
        body: 'PRIVATE_PAYLOAD',
      });
      rememberAdminRequest(request, '/v1/rooms');
      const response = new Response('', { status: 201 });
      const execute = vi.fn(async (input, init) => {
        expect(await new Request(input, init).text()).toBe('PRIVATE_PAYLOAD');
        return response;
      });
      expect(await traceAdminFetch(request, undefined, execute, 'https://api.example.test')).toBe(
        response,
      );
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );
  it('preserves the original operation failure', async () => {
    configureAdminTracing(sdk() as never);
    const request = new Request('https://api.example.test/v1/me');
    rememberAdminRequest(request, '/v1/me');
    const failure = new Error('PRIVATE_CANARY');
    const execute = vi.fn(async () => {
      throw failure;
    });
    await expect(
      traceAdminFetch(request, undefined, execute, 'https://api.example.test'),
    ).rejects.toBe(failure);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
