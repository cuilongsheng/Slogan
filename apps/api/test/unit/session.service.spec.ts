import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { Environment } from '../../src/config/environment.js';
import { AuthError, SessionService } from '../../src/modules/auth/index.js';
import { MemoryAuthRepository } from '../fixtures/fakes.js';

const environment: Environment = {
  APP_NAME: 'slogan-api-test',
  APP_PORT: 3000,
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://slogan:slogan@127.0.0.1:5432/slogan_test',
  CORS_ALLOWED_ORIGINS: ['http://localhost:5173'],
  JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_ISSUER: 'slogan-api-test',
  JWT_AUDIENCE: 'slogan-test-clients',
  REFRESH_TOKEN_PEPPER: 'test-refresh-pepper-with-at-least-32-characters',
  ROOM_PASSWORD_PEPPER: 'test-room-password-pepper-with-32-characters',
  ROOM_RULES_VERSION: '2026-09-v1',
  REFRESH_TOKEN_TTL_SECONDS: 2_592_000,
  AUTH_RATE_LIMIT_POINTS: 100,
  AUTH_RATE_LIMIT_DURATION_SECONDS: 60,
  OAUTH_HTTP_TIMEOUT_MS: 1000,
  GOOGLE_OAUTH_ENABLED: false,
  WECHAT_OAUTH_ENABLED: false,
};

function createService(repository = new MemoryAuthRepository()): SessionService {
  return new SessionService(
    repository,
    new JwtService(),
    new ConfigService<Environment, true>(environment),
  );
}

describe('SessionService', () => {
  it('issues a short access JWT and stores only a refresh-token digest', async () => {
    const repository = new MemoryAuthRepository();
    const service = createService(repository);

    const tokens = await service.issue('user-1', 'test-device');
    const identity = await service.verifyAccessToken(tokens.accessToken);

    expect(identity.userId).toBe('user-1');
    expect(tokens.accessTokenExpiresInSeconds).toBe(900);
    expect(repository.refreshTokenDigests()).toHaveLength(1);
    expect(repository.refreshTokenDigests()[0]).toHaveLength(64);
    expect(repository.refreshTokenDigests()).not.toContain(tokens.refreshToken);
  });

  it('rejects expired refresh tokens', async () => {
    const service = createService();
    const issuedInThePast = new Date(Date.now() - environment.REFRESH_TOKEN_TTL_SECONDS * 1000 - 1);
    const tokens = await service.issue('user-1', undefined, issuedInThePast);

    await expect(service.refresh(tokens.refreshToken)).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_INVALID',
    });
  });

  it('revokes a session so its access token can no longer be used', async () => {
    const service = createService();
    const tokens = await service.issue('user-1');
    const identity = await service.verifyAccessToken(tokens.accessToken);

    await service.revoke(identity);

    await expect(service.verifyAccessToken(tokens.accessToken)).rejects.toMatchObject({
      code: 'ACCESS_TOKEN_INVALID',
    });
  });

  it('allows only one concurrent refresh and invalidates the session after replay', async () => {
    const service = createService();
    const initial = await service.issue('user-1');

    const results = await Promise.allSettled([
      service.refresh(initial.refreshToken),
      service.refresh(initial.refreshToken),
    ]);
    const fulfilled = results.find(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<SessionService['refresh']>>> =>
        result.status === 'fulfilled',
    );
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toBeDefined();
    expect(rejected?.reason).toBeInstanceOf(AuthError);
    expect(rejected?.reason).toMatchObject({ code: 'REFRESH_TOKEN_REUSED' });
    await expect(service.verifyAccessToken(fulfilled!.value.accessToken)).rejects.toMatchObject({
      code: 'ACCESS_TOKEN_INVALID',
    });
  });
});
