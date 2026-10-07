import { Writable } from 'node:stream';

import pino from 'pino';

import { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { LOG_REDACTION } from '../../src/infrastructure/observability/log-redaction.js';

describe('structured log redaction', () => {
  it('redacts refresh cookies from request headers', () => {
    let output = '';
    const logger = pino(
      { redact: LOG_REDACTION },
      {
        write: (line: string) => {
          output += line;
        },
      },
    );
    logger.info({ req: { headers: { cookie: 'slogan_web_refresh=isolated-secret-marker' } } });
    expect(output).not.toContain('isolated-secret-marker');
    expect(JSON.parse(output).req.headers.cookie).toBe('[REDACTED]');
  });
  it('redacts Vercel credentials and signed forwarding headers', () => {
    let output = '';
    const logger = pino(
      { redact: LOG_REDACTION },
      {
        write: (line: string) => {
          output += line;
        },
      },
    );
    const headers = {
      'x-vercel-oidc-token': 'isolated-oidc-secret',
      'x-vercel-proxy-signature': 'Bearer isolated-proxy-secret',
      'x-vercel-protection-bypass': 'isolated-bypass-secret',
      forwarded: 'for=127.0.0.1;sig=isolated-forwarding-secret',
    };
    logger.info({ req: { headers } });
    expect(output).not.toContain('isolated-');
    expect(Object.values(JSON.parse(output).req.headers)).toEqual([
      '[REDACTED]',
      '[REDACTED]',
      '[REDACTED]',
      '[REDACTED]',
    ]);
  });
  it('removes authorization codes, tokens, room passwords, digests and client secrets', () => {
    let output = '';
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString('utf8');
        callback();
      },
    });
    const logger = pino({ redact: LOG_REDACTION }, destination);

    logger.info({
      req: {
        url: '/v1/room-links/private-share-code',
        originalUrl: '/v1/room-links/private-share-code',
        raw: { url: '/v1/room-links/private-share-code' },
        headers: { authorization: 'Bearer private-access-token' },
        body: {
          authorizationCode: 'private-code',
          refreshToken: 'private-refresh-token',
          password: 'room-pin-1234',
        },
      },
      participantToken: 'private-participant-token',
      reason: 'private-backoffice-reason',
      cursor: 'private-backoffice-cursor',
      rawBody: 'private-webhook-payload',
      provider: {
        apiSecret: 'private-livekit-secret',
        clientSecret: 'private-provider-secret',
        passwordDigest: 'private-room-digest',
        roomPasswordPepper: 'private-room-pepper',
      },
      shareCode: 'private-share-code',
      email: 'private-email@example.test',
      token: 'private-email-token',
      managementToken: 'private-enrollment-management-token',
      passwordHash: 'private-email-password-hash',
      mailBody: 'private-mail-body',
      EMAIL_AUTH_AES_KEYS: 'private-aes-key-ring',
      EMAIL_AUTH_HMAC_KEYS: 'private-hmac-key-ring',
      text: 'private-expression-text',
      audio: 'private-audio-content',
      transcript: 'private-transcript',
      rawTranscript: 'private-raw-transcript',
      inputDigest: 'private-input-digest',
      output: { primary: 'private-expression-output' },
      providerBody: {
        responseBody: 'private-provider-body',
        providerResponse: 'private-provider-response',
        providerUrl: 'https://private-provider.example/v1',
        AI_PROVIDER_API_KEY: 'private-ai-key',
        STT_PROVIDER_API_KEY: 'private-stt-key',
      },
      phone: '+8613800138000',
      otp: '123456',
      proof: 'private-step-up-proof',
      grantId: 'private-verification-grant',
      phoneLookupHash: 'private-phone-hash',
      providerPayload: 'private-sms-payload',
      OPERATIONS_ALERT_SINK_TOKEN: 'private-alert-token',
      OPERATIONS_ALERT_SINK_URL: 'https://private-alert.example/hook',
      DATABASE_URL: 'postgresql://user:private-db-password@db.example/app',
      BACKUP_ENCRYPTION_KEY_ID: 'private-backup-key',
      candidate: {
        candidateText: 'private-candidate',
        displayText: 'private-final-item',
        normalizedText: 'private-normalized-item',
        note: 'private-vocabulary-note',
      },
    });

    expect(output).not.toContain('private-access-token');
    expect(output).not.toContain('private-code');
    expect(output).not.toContain('private-refresh-token');
    expect(output).not.toContain('private-provider-secret');
    expect(output).not.toContain('room-pin-1234');
    expect(output).not.toContain('private-room-digest');
    expect(output).not.toContain('private-room-pepper');
    expect(output).not.toContain('private-share-code');
    expect(output).not.toContain('private-backoffice-reason');
    expect(output).not.toContain('private-backoffice-cursor');
    expect(output).not.toContain('private-expression-text');
    expect(output).not.toContain('private-audio-content');
    expect(output).not.toContain('private-transcript');
    expect(output).not.toContain('private-raw-transcript');
    expect(output).not.toContain('private-input-digest');
    expect(output).not.toContain('private-expression-output');
    expect(output).not.toContain('private-provider-body');
    expect(output).not.toContain('private-provider-response');
    expect(output).not.toContain('private-provider.example');
    expect(output).not.toContain('private-ai-key');
    expect(output).not.toContain('private-stt-key');
    expect(output).not.toContain('private-candidate');
    expect(output).not.toContain('private-final-item');
    expect(output).not.toContain('private-normalized-item');
    expect(output).not.toContain('private-vocabulary-note');
    expect(output).not.toContain('+8613800138000');
    expect(output).not.toContain('123456');
    expect(output).not.toContain('private-step-up-proof');
    expect(output).not.toContain('private-verification-grant');
    expect(output).not.toContain('private-phone-hash');
    expect(output).not.toContain('private-sms-payload');
    expect(output).not.toContain('private-alert-token');
    expect(output).not.toContain('private-alert.example');
    expect(output).not.toContain('private-db-password');
    expect(output).not.toContain('private-backup-key');
    for (const value of [
      'private-email@example.test',
      'private-email-token',
      'private-enrollment-management-token',
      'private-email-password-hash',
      'private-mail-body',
      'private-aes-key-ring',
      'private-hmac-key-ring',
      'private-participant-token',
      'private-webhook-payload',
      'private-livekit-secret',
    ])
      expect(output).not.toContain(value);
    expect(output).toContain('[REDACTED]');
  });
  it('does not stringify structured messages before redacting their fields', () => {
    let output = '';
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const service = new StructuredLogger();
    Object.assign(service, { logger: pino({ redact: LOG_REDACTION }, destination) });
    service.warn({
      event: 'provider_failure',
      participantToken: 'do-not-log-token',
      provider: { apiSecret: 'do-not-log-secret' },
      text: 'do-not-log-input',
      phase: 'STT',
      durationMs: 125,
      resultCode: 'ASSISTANCE_PROVIDER_TIMEOUT',
    });
    expect(output).toContain('provider_failure');
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('do-not-log');
    expect(output).toContain('STT');
    expect(output).toContain('125');
    expect(output).toContain('ASSISTANCE_PROVIDER_TIMEOUT');
  });
});
