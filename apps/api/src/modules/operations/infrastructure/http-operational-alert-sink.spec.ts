import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { fn, spyOn } from 'jest-mock';
import { HttpOperationalAlertSink } from './http-operational-alert-sink.js';
import { IncidentsService, type OperationalAlertSink } from '../index.js';
import { testEnvironment } from '../../../../test/fixtures/environment.js';

describe('minimal alert sink and governance separation', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });
  it('sends only canonical technical fields and removes unknown content', async () => {
    const fetch = fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('', { status: 200 }),
    );
    globalThis.fetch = fetch;
    const config = new ConfigService<Environment, true>(
      testEnvironment({
        OPERATIONS_ALERT_SINK_URL: 'http://127.0.0.1:9999/fixture',
        OPERATIONS_ALERT_SINK_TOKEN: 'synthetic-token-with-thirty-two-characters',
      }),
    );
    const sink = new HttpOperationalAlertSink(config);
    await sink.send({
      status: 'OPEN',
      component: 'POSTGRESQL',
      category: 'READINESS',
      severity: 'WARNING',
      scopeType: 'GLOBAL',
      reasonCode: 'POSTGRESQL_UNAVAILABLE',
      firstObservedAt: '2026-10-14T00:00:00.000Z',
      rawBody: 'PRIVATE_CANARY',
    } as never);
    expect(String(fetch.mock.calls[0]![1]!.body)).not.toContain('PRIVATE_CANARY');
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({
      status: 'OPEN',
      component: 'POSTGRESQL',
      category: 'READINESS',
      severity: 'WARNING',
      scopeType: 'GLOBAL',
      reasonCode: 'POSTGRESQL_UNAVAILABLE',
      firstObservedAt: '2026-10-14T00:00:00.000Z',
    });
    fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(
      sink.send({
        status: 'OPEN',
        component: 'POSTGRESQL',
        category: 'READINESS',
        severity: 'WARNING',
        scopeType: 'GLOBAL',
        reasonCode: 'POSTGRESQL_UNAVAILABLE',
        firstObservedAt: '2026-10-14T00:00:00.000Z',
      }),
    ).rejects.toThrow('ALERT_SINK_REJECTED');
  });
  it('acknowledges Sentry ingest only on success, strips content and keeps retryable failures', async () => {
    const fetch = fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('', { status: 200 }),
    );
    globalThis.fetch = fetch;
    const sink = new HttpOperationalAlertSink(
      new ConfigService<Environment, true>(
        testEnvironment({
          OPERATIONS_ALERT_SINK_KIND: 'sentry',
          SENTRY_DSN: 'https://0123456789abcdef@o123.ingest.us.sentry.io/123',
        }),
      ),
    );
    const payload = {
      status: 'OPEN',
      component: 'POSTGRESQL',
      category: 'READINESS',
      severity: 'WARNING',
      scopeType: 'GLOBAL',
      reasonCode: 'POSTGRESQL_UNAVAILABLE',
      firstObservedAt: '2026-10-15T00:00:00.000Z',
      rawBody: 'PRIVATE_CANARY',
    };
    await sink.send(payload as never);
    const [endpoint, options] = fetch.mock.calls[0]!;
    expect(new URL(String(endpoint)).pathname).toBe('/api/123/envelope/');
    expect(options?.redirect).toBe('error');
    const body = String(options!.body);
    expect(body).not.toContain('PRIVATE_CANARY');
    expect(body).toContain('OPERATIONAL_ALERT');
    expect(body).not.toContain('0123456789abcdef');
    fetch.mockResolvedValueOnce(new Response('', { status: 429 }));
    await expect(sink.send(payload as never)).rejects.toThrow('ALERT_SINK_RATE_LIMITED');
    await sink.send({ ...payload, status: 'RESOLVED' } as never);
    expect(String(fetch.mock.calls[2]![1]!.body)).toContain('OPERATIONAL_RECOVERY');
  });
  it('allows monitoring delivery but never enables incident mutation under the governance flag', async () => {
    const repository = {
      claimDelivery: fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null),
      command: fn(),
    };
    const service = new IncidentsService(
      repository as never,
      { send: async () => undefined },
      new ConfigService(
        testEnvironment({
          OBSERVABILITY_MONITOR_ENABLED: true,
          OPERATIONS_GOVERNANCE_ENABLED: false,
        }),
      ),
    );
    await expect(service.dispatchOne()).resolves.toEqual({ handled: false });
    expect(repository.claimDelivery).toHaveBeenCalled();
    expect(() =>
      service.command('actor', ['PLATFORM_ADMIN'], 'incident', 'ACKNOWLEDGE', 'reason', 'request'),
    ).toThrow();
    expect(repository.command).not.toHaveBeenCalled();
  });
});

const payload: Parameters<OperationalAlertSink['send']>[0] = {
  status: 'OPEN',
  component: 'REALTIME_COMMAND',
  category: 'READINESS',
  severity: 'WARNING',
  scopeType: 'GLOBAL',
  reasonCode: 'COMMAND_BACKLOG',
  firstObservedAt: '2026-10-17T14:27:01.425Z',
};

const rejectionTestOriginalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = rejectionTestOriginalFetch;
});

describe.each(['http', 'sentry'] as const)('%s operational alert rejection', (kind) => {
  function sink() {
    return new HttpOperationalAlertSink(
      new ConfigService<Environment, true>(
        testEnvironment({
          OPERATIONS_ALERT_SINK_KIND: kind,
          OPERATIONS_ALERT_SINK_URL: 'https://alerts.example.test/notify',
          OPERATIONS_ALERT_SINK_TOKEN: 'fixture-only-private-token-1234567890',
          SENTRY_DSN: 'https://fixturepublickey@o1.ingest.sentry.io/1',
        }),
      ),
    );
  }

  it.each([
    [401, 'ALERT_SINK_AUTH_REJECTED'],
    [403, 'ALERT_SINK_AUTH_REJECTED'],
    [429, 'ALERT_SINK_RATE_LIMITED'],
    [400, 'ALERT_SINK_PAYLOAD_REJECTED'],
    [422, 'ALERT_SINK_PAYLOAD_REJECTED'],
    [503, 'ALERT_SINK_REJECTED'],
  ] as const)('classifies HTTP %s without retaining response content', async (status, code) => {
    const response = new Response('private-provider-content-canary', { status });
    const readBody = spyOn(response, 'text');
    globalThis.fetch = fn<typeof fetch>().mockResolvedValue(response);
    try {
      await sink().send(payload);
      throw new Error('EXPECTED_REJECTION');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(code);
      expect((error as Error).cause).toBeUndefined();
    }
    expect(readBody).not.toHaveBeenCalled();
    expect(response.body?.locked).toBe(false);
  });

  it('accepts a successful response without changing the delivery contract', async () => {
    globalThis.fetch = fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(sink().send(payload)).resolves.toBeUndefined();
  });
});
