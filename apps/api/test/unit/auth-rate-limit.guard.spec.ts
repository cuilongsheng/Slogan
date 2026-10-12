import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';

import { AuthRateLimitGuard } from '../../src/common/guards/auth-rate-limit.guard.js';
import type { Environment } from '../../src/config/environment.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('AuthRateLimitGuard', () => {
  it('limits repeated requests by client and authentication path', async () => {
    // ConfigService falls back to process.env for missing keys; explicitly disable Redis here.
    const guard = new AuthRateLimitGuard(
      new ConfigService<Environment, true>(
        testEnvironment({
          REDIS_URL: '',
          AUTH_RATE_LIMIT_POINTS: 1,
          AUTH_RATE_LIMIT_DURATION_SECONDS: 60,
        }),
      ),
    );
    const request = {
      ip: '127.0.0.1',
      path: '/v1/auth/refresh',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    try {
      await expect(guard.canActivate(context)).resolves.toBe(true);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        statusCode: 429,
      });
    } finally {
      guard.onModuleDestroy();
    }
  });
});
