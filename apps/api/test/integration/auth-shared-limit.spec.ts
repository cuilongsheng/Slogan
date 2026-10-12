import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { AuthRateLimitGuard } from '../../src/common/guards/auth-rate-limit.guard.js';
import type { Environment } from '../../src/config/environment.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('shared authentication quotas', () => {
  it('shares one quota between two independent guards and rejects Redis outages', async () => {
    const config = new ConfigService<Environment, true>(
      testEnvironment({ REDIS_URL: 'redis://127.0.0.1:56379/13', AUTH_RATE_LIMIT_POINTS: 1 }),
    );
    const first = new AuthRateLimitGuard(config),
      second = new AuthRateLimitGuard(config);
    const request = {
      ip: '192.0.2.20',
      path: `/v1/auth/refresh/${randomUUID()}`,
      headers: {},
      socket: { remoteAddress: '192.0.2.20' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    try {
      await expect(first.canActivate(context)).resolves.toBe(true);
      await expect(second.canActivate(context)).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        statusCode: 429,
      });
    } finally {
      first.onModuleDestroy();
      second.onModuleDestroy();
    }
    const unavailable = new AuthRateLimitGuard(
      new ConfigService<Environment, true>(
        testEnvironment({ REDIS_URL: 'redis://127.0.0.1:1/13' }),
      ),
    );
    try {
      await expect(unavailable.canActivate(context)).rejects.toMatchObject({
        code: 'AUTH_LIMITER_UNAVAILABLE',
        statusCode: 503,
      });
    } finally {
      unavailable.onModuleDestroy();
    }
  });
});
