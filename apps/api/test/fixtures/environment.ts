import type { Environment } from '../../src/config/environment.js';

export function testEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    APP_NAME: 'slogan-api-test',
    APP_PORT: 3000,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://slogan:slogan@127.0.0.1:54329/slogan_test',
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
    ...overrides,
  };
}

export function installTestEnvironment(overrides: Partial<Environment> = {}): void {
  const environment = testEnvironment(overrides);
  for (const [key, value] of Object.entries(environment)) {
    process.env[key] = Array.isArray(value) ? value.join(',') : String(value);
  }
}

export function rawTestEnvironment(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const environment = testEnvironment();
  return {
    ...Object.fromEntries(
      Object.entries(environment).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(',') : String(value),
      ]),
    ),
    ...overrides,
  };
}
