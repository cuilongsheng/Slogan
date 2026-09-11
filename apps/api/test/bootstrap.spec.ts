import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module.js';
import { validateEnvironment } from '../src/config/environment.js';
import { installTestEnvironment, rawTestEnvironment } from './fixtures/environment.js';

describe('API bootstrap', () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => installTestEnvironment());

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('initializes and closes without external infrastructure', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();

    await app.init();
    await app.close();
  });

  it('rejects missing required configuration', () => {
    expect(() => validateEnvironment({})).toThrow();
  });

  it.each([
    ['short JWT secret', rawTestEnvironment({ JWT_ACCESS_SECRET: 'too-short' })],
    ['invalid access TTL', rawTestEnvironment({ JWT_ACCESS_TTL_SECONDS: '10' })],
    ['invalid CORS origin', rawTestEnvironment({ CORS_ALLOWED_ORIGINS: 'not-a-url' })],
    ['short room password pepper', rawTestEnvironment({ ROOM_PASSWORD_PEPPER: 'too-short' })],
    ['blank room rules version', rawTestEnvironment({ ROOM_RULES_VERSION: '   ' })],
    [
      'enabled Google provider without credentials',
      rawTestEnvironment({ GOOGLE_OAUTH_ENABLED: 'true' }),
    ],
  ])('rejects %s', (_label, input) => {
    expect(() => validateEnvironment(input as Record<string, unknown>)).toThrow();
  });

  it('accepts a complete serialized environment', () => {
    expect(validateEnvironment(rawTestEnvironment())).toMatchObject({
      JWT_ACCESS_TTL_SECONDS: 900,
      CORS_ALLOWED_ORIGINS: ['http://localhost:5173'],
      ROOM_RULES_VERSION: '2026-09-v1',
    });
  });
});
