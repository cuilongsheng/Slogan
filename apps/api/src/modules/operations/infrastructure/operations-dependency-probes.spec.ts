import { ConfigService } from '@nestjs/config';
import { NetworkOperationsDependencyProbes } from './operations-dependency-probes.js';
import { testEnvironment } from '../../../../test/fixtures/environment.js';

it.each([200, 401, 403, 404, 503])(
  'does not infer business readiness from provider HEAD %s',
  async (status) => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response('PRIVATE_CANARY', { status });
    const tx = { $executeRaw: async () => 0, $queryRaw: async () => [] };
    const prisma = {
      $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    };
    const probes = new NetworkOperationsDependencyProbes(
      new ConfigService(
        testEnvironment({
          PHONE_AUTH_ENABLED: true,
          SMS_PROVIDER_BASE_URL: 'http://localhost:9999/synthetic-provider',
          SMS_PROVIDER_API_KEY: 'PRIVATE_CANARY',
        }),
      ),
      prisma as never,
    );
    try {
      const sms = (await probes.check()).find((probe) => probe.component === 'SMS');
      expect(sms?.ready).toBe(false);
      expect(sms?.unknown ?? false).toBe([200, 404].includes(status));
      expect(sms?.reasonCode).toBe(
        [401, 403].includes(status)
          ? 'SMS_AUTH_REJECTED'
          : status === 503
            ? 'SMS_UNAVAILABLE'
            : 'SMS_READINESS_UNKNOWN',
      );
      expect(JSON.stringify(sms)).not.toContain('PRIVATE_CANARY');
    } finally {
      globalThis.fetch = original;
      await probes.onModuleDestroy();
    }
  },
);
