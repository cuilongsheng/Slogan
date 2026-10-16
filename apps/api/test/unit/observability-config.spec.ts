import { validateEnvironment } from '../../src/config/environment.js';
import { rawTestEnvironment } from '../fixtures/environment.js';

describe('observability configuration', () => {
  it('is off by default and does not require credentials', () => {
    expect(validateEnvironment(rawTestEnvironment())).toMatchObject({
      OBSERVABILITY_ENABLED: false,
      OBSERVABILITY_MONITOR_ENABLED: false,
    });
  });
  it('rejects incomplete enabled configuration without disclosing input', () => {
    expect(() =>
      validateEnvironment(
        rawTestEnvironment({ OBSERVABILITY_ENABLED: 'true', SENTRY_DSN: 'PRIVATE_CANARY' }),
      ),
    ).toThrow('Invalid environment configuration: OBSERVABILITY_ENABLED');
  });
  it('accepts explicit isolated configuration and restricts heartbeat endpoints', () => {
    const input = rawTestEnvironment({
      OBSERVABILITY_ENABLED: 'true',
      OBSERVABILITY_ENVIRONMENT: 'test',
      OBSERVABILITY_RELEASE: 'slogan-api@abcdef123456',
      OBSERVABILITY_BUILD: 'abcdef123456',
      SENTRY_DSN: 'https://0123456789abcdef@o123.ingest.us.sentry.io/123',
    });
    expect(validateEnvironment(input).OBSERVABILITY_ENABLED).toBe(true);
    expect(() =>
      validateEnvironment({
        ...input,
        OBSERVABILITY_MONITOR_HEARTBEAT_URL: 'https://private:secret@example.com/heartbeat',
      }),
    ).toThrow();
  });
});
