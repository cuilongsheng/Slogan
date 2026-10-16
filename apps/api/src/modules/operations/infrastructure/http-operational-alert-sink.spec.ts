import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { fn } from 'jest-mock';
import { HttpOperationalAlertSink } from './http-operational-alert-sink.js';
import { IncidentsService } from '../index.js';
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
    await expect(sink.send(payload as never)).rejects.toThrow('ALERT_SINK_REJECTED');
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
