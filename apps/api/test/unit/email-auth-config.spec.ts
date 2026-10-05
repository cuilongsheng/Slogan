import { validateEnvironment } from '../../src/config/environment.js';
import { rawTestEnvironment } from '../fixtures/environment.js';
import { emailEnvironment, emailConfig } from '../fixtures/email-auth.js';
import { EmailSecurityAdapter } from '../../src/modules/auth/testing.js';

describe('email authentication configuration and encryption', () => {
  it('defaults off and preserves existing authentication config', () => {
    expect(validateEnvironment(rawTestEnvironment()).EMAIL_PASSWORD_AUTH_ENABLED).toBe(false);
    expect(() => emailEnvironment()).not.toThrow();
  });
  it.each([
    'EMAIL_SMTP_HOST',
    'EMAIL_SMTP_FROM',
    'EMAIL_VERIFY_URL',
    'EMAIL_RESET_URL',
    'EMAIL_AUTH_HMAC_KEYS',
    'EMAIL_AUTH_AES_KEYS',
    'REDIS_URL',
  ])('requires %s without leaking values', (key) => {
    expect(() => emailEnvironment({ [key]: undefined })).toThrow();
  });
  it('requires TLS outside local tests and rejects unsafe link targets and unknown key IDs', () => {
    for (const override of [
      { EMAIL_SMTP_HOST: 'smtp.example.test' },
      { EMAIL_SMTP_TLS_MODE: 'STARTTLS' },
      { EMAIL_VERIFY_URL: 'https://app.example.test/verify?token=x' },
      { EMAIL_RESET_URL: 'http://localhost/reset' },
      { EMAIL_AUTH_AES_KEY_ID: 'missing' },
      { EMAIL_AUTH_HMAC_KEYS: 'private-secret-value' },
    ]) {
      try {
        emailEnvironment(override);
        throw new Error('accepted');
      } catch (error) {
        expect(String(error)).not.toContain('private-secret-value');
        expect(String(error)).not.toBe('Error: accepted');
      }
    }
  });
  it('supports mail-free password preview in production without SMTP/AES/links, while keeping mandatory HMAC/Redis', () => {
    const overrides = {
      NODE_ENV: 'production',
      ROOM_SHARE_BASE_URL: 'https://app.example.test/rooms/',
      EMAIL_AUTH_MAIL_ENABLED: false,
      PREVIEW_ACCOUNTS_ENABLED: true,
      PREVIEW_ENVIRONMENT_ID: 'preview-production',
      EMAIL_SMTP_HOST: undefined,
      EMAIL_SMTP_FROM: undefined,
      EMAIL_AUTH_AES_KEYS: undefined,
      EMAIL_VERIFY_URL: undefined,
      EMAIL_RESET_URL: undefined,
    };
    expect(emailEnvironment(overrides).EMAIL_AUTH_MAIL_ENABLED).toBe(false);
    for (const key of ['EMAIL_AUTH_HMAC_KEYS', 'REDIS_URL', 'PREVIEW_ENVIRONMENT_ID'])
      expect(() => emailEnvironment({ ...overrides, [key]: undefined })).toThrow();
    expect(() => emailEnvironment({ ...overrides, EMAIL_PASSWORD_AUTH_ENABLED: false })).toThrow();
    expect(() => emailEnvironment({ ...overrides, EMAIL_AUTH_MAIL_ENABLED: true })).toThrow();
    expect(emailEnvironment().EMAIL_AUTH_MAIL_ENABLED).toBe(true);
    expect(validateEnvironment(rawTestEnvironment()).EMAIL_AUTH_MAIL_ENABLED).toBe(false);
  });
  it('authenticates payload, record identity and key ID, and reads retained keys', () => {
    const security = new EmailSecurityAdapter(emailConfig());
    const payload = {
      to: 'fixture@example.test',
      token: security.newToken(),
      purpose: 'REGISTER' as const,
    };
    const a = security.encrypt('delivery-a', payload);
    expect(a.encryptedPayload).not.toContain(payload.token);
    expect(security.decrypt('delivery-a', a.encryptedPayload, a.keyId)).toEqual(payload);
    expect(() => security.decrypt('delivery-b', a.encryptedPayload, a.keyId)).toThrow();
    const rotated = new EmailSecurityAdapter(
      emailConfig({
        EMAIL_AUTH_AES_KEY_ID: 'v2',
        EMAIL_AUTH_AES_KEYS: JSON.stringify({
          v1: Buffer.alloc(32, 2).toString('base64'),
          v2: Buffer.alloc(32, 3).toString('base64'),
        }),
      }),
    );
    expect(rotated.decrypt('delivery-a', a.encryptedPayload, a.keyId)).toEqual(payload);
    expect(security.digest(payload.token)).not.toContain(payload.token);
  });
});
