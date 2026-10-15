import { describe, it, expect } from 'vitest';
import {
  tracingSampleRate,
  traceableApiRequest,
  sanitizeTraceHeaders,
  sanitizePerformanceSpan,
} from '../src/observability-tracing';

describe('bounded tracing policy', () => {
  it('defaults to ten percent, supports disabling and rejects unsafe rates', () => {
    expect(tracingSampleRate(undefined)).toBe(0.1);
    expect(tracingSampleRate('0')).toBe(0);
    for (const value of ['', 'PRIVATE_CANARY', '-1', '2', 'Infinity']) {
      expect(() => tracingSampleRate(value)).toThrow('Invalid tracing sample rate');
    }
  });
  it('matches only schema templates on the exact configured origin', () => {
    const url = { origin: 'https://api.example.test', pathname: '/v1/rooms/private' };
    expect(traceableApiRequest(url, url.origin, '/v1/rooms/{roomId}')).toBe(true);
    expect(traceableApiRequest(url, 'https://other.test', '/v1/rooms/{roomId}')).toBe(false);
    expect(traceableApiRequest(url, url.origin, '/v1/users/{userId}')).toBe(false);
    expect(
      traceableApiRequest({ ...url, username: 'secret' }, url.origin, '/v1/rooms/{roomId}'),
    ).toBe(false);
  });
  it('removes arbitrary baggage and rejects malformed trace identifiers', () => {
    const trace = `${'a'.repeat(32)}-${'b'.repeat(16)}-1`;
    const result = sanitizeTraceHeaders({
      'sentry-trace': trace,
      baggage: `user=PRIVATE_CANARY,sentry-user_id=PRIVATE_CANARY,sentry-release=PRIVATE_CANARY,sentry-org_id=123,sentry-trace_id=${'a'.repeat(32)},sentry-sampled=true`,
      authorization: 'PRIVATE_CANARY',
    });
    expect(result['sentry-trace']).toBe(trace);
    expect(result.baggage).toContain('sentry-org_id=123');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_CANARY');
    expect(sanitizeTraceHeaders({ 'sentry-trace': 'PRIVATE_CANARY' })).toEqual({});
  });
  it.each([false, true])(
    'strips URL, SQL, identity and links from SDK streaming=%s',
    (streaming) => {
      const attrs = {
        'sentry.op': 'http.client',
        'http.request.method': 'GET',
        'http.route': '/v1/rooms/{roomId}',
        'http.response.status_code': 503,
        'url.full': 'PRIVATE_CANARY',
        'db.query.text': 'PRIVATE_CANARY',
        'user.id': 'PRIVATE_CANARY',
      };
      const clean = sanitizePerformanceSpan({
        trace_id: 'a'.repeat(32),
        span_id: 'b'.repeat(16),
        start_timestamp: 1,
        timestamp: 2,
        status: streaming ? 'error' : 'internal_error',
        ...(streaming
          ? { name: 'PRIVATE_CANARY', attributes: attrs }
          : { description: 'PRIVATE_CANARY', op: 'http.client', data: attrs }),
        links: [{ attributes: { secret: 'PRIVATE_CANARY' } }],
      });
      expect(JSON.stringify(clean)).not.toContain('PRIVATE_CANARY');
      expect(clean[streaming ? 'name' : 'description']).toBe('GET /v1/rooms/{roomId}');
      expect(clean.status).toBe(streaming ? 'error' : 'internal_error');
    },
  );
});
