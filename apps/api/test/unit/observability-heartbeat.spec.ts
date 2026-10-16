import { ConfigService } from '@nestjs/config';
import { fn } from 'jest-mock';
import { ObservabilityHeartbeat } from '../../src/infrastructure/observability/heartbeat.service.js';
import { testEnvironment } from '../fixtures/environment.js';

it('sends only bounded completion pings for enabled duties and isolates transport rejection', async () => {
  const original = globalThis.fetch;
  const fetch = fn<typeof globalThis.fetch>().mockRejectedValue(new Error('PRIVATE_CANARY'));
  globalThis.fetch = fetch;
  try {
    const heartbeat = new ObservabilityHeartbeat(
      new ConfigService(
        testEnvironment({
          OBSERVABILITY_MONITOR_ENABLED: true,
          OBSERVABILITY_MONITOR_HEARTBEAT_URL: 'http://localhost:9999/synthetic-heartbeat',
          OBSERVABILITY_AUTH_MAIL_HEARTBEAT_URL: 'http://localhost:9999/disabled-duty',
        }),
      ),
    );
    await expect(heartbeat.completed('monitor')).resolves.toBeUndefined();
    await heartbeat.completed('monitor');
    await heartbeat.completed('auth-mail');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ method: 'POST', body: '', signal: expect.any(AbortSignal) }),
    );
  } finally {
    globalThis.fetch = original;
  }
});
