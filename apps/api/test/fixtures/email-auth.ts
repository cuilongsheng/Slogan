import { ConfigService } from '@nestjs/config';
import { type Environment, validateEnvironment } from '../../src/config/environment.js';
import { rawTestEnvironment } from './environment.js';

export function emailEnvironment(overrides: Record<string, unknown> = {}) {
  return validateEnvironment({
    ...rawTestEnvironment(),
    EMAIL_PASSWORD_AUTH_ENABLED: true,
    EMAIL_SMTP_HOST: '127.0.0.1',
    EMAIL_SMTP_PORT: 2525,
    EMAIL_SMTP_TLS_MODE: 'LOCAL_TEST',
    EMAIL_SMTP_FROM: 'auth@example.test',
    EMAIL_VERIFY_URL: 'https://app.example.test/verify',
    EMAIL_RESET_URL: 'https://app.example.test/reset',
    EMAIL_AUTH_HMAC_KEYS: JSON.stringify({ v1: Buffer.alloc(32, 1).toString('base64') }),
    EMAIL_AUTH_AES_KEYS: JSON.stringify({ v1: Buffer.alloc(32, 2).toString('base64') }),
    REDIS_URL: 'redis://127.0.0.1:56379',
    ...overrides,
  });
}
export function emailConfig(overrides: Record<string, unknown> = {}) {
  return new ConfigService<Environment, true>(emailEnvironment(overrides));
}
