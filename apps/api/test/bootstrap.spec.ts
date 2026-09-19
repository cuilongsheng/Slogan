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
    ['realtime without credentials', rawTestEnvironment({ REALTIME_ENABLED: 'true' })],
    ['invalid realtime TTL', rawTestEnvironment({ LIVEKIT_TOKEN_TTL_SECONDS: '601' })],
    ['short JWT secret', rawTestEnvironment({ JWT_ACCESS_SECRET: 'too-short' })],
    ['invalid access TTL', rawTestEnvironment({ JWT_ACCESS_TTL_SECONDS: '10' })],
    ['invalid CORS origin', rawTestEnvironment({ CORS_ALLOWED_ORIGINS: 'not-a-url' })],
    ['short room password pepper', rawTestEnvironment({ ROOM_PASSWORD_PEPPER: 'too-short' })],
    ['blank room rules version', rawTestEnvironment({ ROOM_RULES_VERSION: '   ' })],
    [
      'insecure production share URL',
      rawTestEnvironment({
        NODE_ENV: 'production',
        ROOM_SHARE_BASE_URL: 'http://example.com/rooms/',
      }),
    ],
    [
      'share URL with credentials',
      rawTestEnvironment({ ROOM_SHARE_BASE_URL: 'https://user:secret@example.com/rooms/' }),
    ],
    [
      'enabled Google provider without credentials',
      rawTestEnvironment({ GOOGLE_OAUTH_ENABLED: 'true' }),
    ],
    [
      'audio assistance without text assistance',
      rawTestEnvironment({ ASSISTANCE_AUDIO_ENABLED: 'true' }),
    ],
    ['assistance without provider policy', rawTestEnvironment({ ASSISTANCE_ENABLED: 'true' })],
    ['phone auth without provider policy', rawTestEnvironment({ PHONE_AUTH_ENABLED: 'true' })],
    [
      'account lifecycle without Redis',
      rawTestEnvironment({ ACCOUNT_LIFECYCLE_ENABLED: 'true', REDIS_URL: undefined }),
    ],
    [
      'provider retention over seven days',
      rawTestEnvironment({ AI_EXPRESSION_RETENTION_SECONDS: String(604_801) }),
    ],
  ])('rejects %s', (_label, input) => {
    expect(() => validateEnvironment(input as Record<string, unknown>)).toThrow();
  });

  it('accepts isolated Cloud configuration and rejects invalid provider URLs', () => {
    const config = rawTestEnvironment({
      REALTIME_ENABLED: 'true',
      LIVEKIT_URL: 'wss://test.livekit.cloud',
      LIVEKIT_API_KEY: 'test-key',
      LIVEKIT_API_SECRET: 'test-secret-with-more-than-32-characters',
      REDIS_URL: 'redis://localhost:6379',
    });
    expect(validateEnvironment(config).REALTIME_ENABLED).toBe(true);
    for (const url of [
      'ws://test.livekit.cloud',
      'wss://livekit.cloud.evil.test',
      'wss://user:pass@test.livekit.cloud',
    ]) {
      expect(() => validateEnvironment({ ...config, LIVEKIT_URL: url })).toThrow();
    }
    expect(() => validateEnvironment({ ...config, REDIS_URL: 'https://localhost' })).toThrow();
  });

  it('accepts a complete serialized environment', () => {
    expect(validateEnvironment(rawTestEnvironment())).toMatchObject({
      JWT_ACCESS_TTL_SECONDS: 900,
      CORS_ALLOWED_ORIGINS: ['http://localhost:5173'],
      ROOM_RULES_VERSION: '2026-09-v1',
      ROOM_SHARE_BASE_URL: 'http://localhost:5173/rooms/',
    });
  });

  it('accepts text-only assistance without STT and requires STT for audio', () => {
    const textOnly = rawTestEnvironment({
      ASSISTANCE_ENABLED: 'true',
      REDIS_URL: 'redis://localhost:6379/15',
      AI_EXPRESSION_PROVIDER_CATEGORY: 'TEST_AI',
      AI_EXPRESSION_BASE_URL: 'http://localhost:4444',
      AI_EXPRESSION_API_KEY: 'test-key',
      AI_EXPRESSION_MODEL: 'test-model',
      AI_EXPRESSION_REGION: 'local',
      AI_EXPRESSION_RETENTION_SECONDS: '0',
      AI_EXPRESSION_NO_TRAINING: 'true',
    });
    expect(validateEnvironment(textOnly).ASSISTANCE_ENABLED).toBe(true);
    expect(() => validateEnvironment({ ...textOnly, ASSISTANCE_AUDIO_ENABLED: 'true' })).toThrow();
  });

  it('accepts phone auth only with Redis, independent peppers, provider policy and regions', () => {
    const phone = rawTestEnvironment({
      PHONE_AUTH_ENABLED: 'true',
      REDIS_URL: 'redis://localhost:6379/10',
      PHONE_IDENTITY_PEPPER: 'phone-identity-pepper-with-at-least-32-characters',
      PHONE_OTP_CODE_PEPPER: 'phone-code-pepper-with-at-least-32-characters',
      SMS_PROVIDER_CATEGORY: 'TEST_SMS',
      SMS_PROVIDER_BASE_URL: 'http://localhost:4999/send',
      SMS_PROVIDER_API_KEY: 'test-sms-key',
      SMS_PROVIDER_SENDER: 'Slogan',
      SMS_PROVIDER_TEMPLATE: 'login',
      SMS_SUPPORTED_REGIONS: 'CN,US',
    });
    expect(validateEnvironment(phone).PHONE_AUTH_ENABLED).toBe(true);
    expect(() => validateEnvironment({ ...phone, PHONE_OTP_CODE_PEPPER: 'short' })).toThrow(
      'Phone authentication requires',
    );
  });

  it('requires the complete short-window STT policy for room speech processing', () => {
    const roomSpeech = rawTestEnvironment({
      REALTIME_ENABLED: 'true',
      LIVEKIT_URL: 'wss://test.livekit.cloud',
      LIVEKIT_API_KEY: 'test-key',
      LIVEKIT_API_SECRET: 'test-secret-with-more-than-32-characters',
      REDIS_URL: 'redis://localhost:6379/11',
      ROOM_SPEECH_DETECTION_ENABLED: 'true',
      ROOM_SPEECH_HASH_SECRET: 'room-speech-hash-secret-over-32-characters',
      STT_PROVIDER_CATEGORY: 'TEST_STT',
      STT_BASE_URL: 'http://localhost:5555',
      STT_API_KEY: 'test-stt-key',
      STT_MODEL: 'test-stt',
      STT_REGION: 'local',
      STT_DATA_USE: 'REQUEST_PROCESSING_ONLY',
      STT_RETENTION_SECONDS: '0',
      STT_DELETION_MODE: 'NO_RETENTION',
      STT_STREAMING_MODE: 'SHORT_WINDOW',
    });
    expect(validateEnvironment(roomSpeech).ROOM_SPEECH_DETECTION_ENABLED).toBe(true);
    expect(() => validateEnvironment({ ...roomSpeech, STT_STREAMING_MODE: undefined })).toThrow(
      'Room speech detection requires',
    );
  });

  it('requires the shared realtime and short-window STT policy for post-room keywords', () => {
    const keywords = rawTestEnvironment({
      REALTIME_ENABLED: 'true',
      LIVEKIT_URL: 'wss://test.livekit.cloud',
      LIVEKIT_API_KEY: 'test-key',
      LIVEKIT_API_SECRET: 'test-secret-with-more-than-32-characters',
      REDIS_URL: 'redis://localhost:6379/11',
      POST_ROOM_KEYWORDS_ENABLED: 'true',
      STT_PROVIDER_CATEGORY: 'TEST_STT',
      STT_BASE_URL: 'http://localhost:5555',
      STT_API_KEY: 'test-stt-key',
      STT_MODEL: 'test-stt',
      STT_REGION: 'local',
      STT_DATA_USE: 'REQUEST_PROCESSING_ONLY',
      STT_RETENTION_SECONDS: '0',
      STT_DELETION_MODE: 'NO_RETENTION',
      STT_STREAMING_MODE: 'SHORT_WINDOW',
    });
    expect(validateEnvironment(keywords).POST_ROOM_KEYWORDS_ENABLED).toBe(true);
    expect(() => validateEnvironment({ ...keywords, REDIS_URL: undefined })).toThrow(
      'Post-room keywords require',
    );
  });
});
