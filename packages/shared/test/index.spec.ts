import { describe, expect, it } from 'vitest';

import {
  sanitizeObservabilityEvent,
  classifyObservabilityError,
  validRequestId,
  validSentryDsn,
  ObservabilityRateLimit,
  type ObservabilityMetadata,
} from '../src/index';

const metadata: ObservabilityMetadata = {
  environment: 'test',
  service: 'api',
  platform: 'node',
  release: 'slogan-api@abcdef123456',
  build: 'abcdef123456',
};
describe('observability privacy boundary', () => {
  it('reconstructs events without nested private content while preserving source location', () => {
    const privateValue = 'PRIVATE_CANARY_AUDIO_TOKEN_EMAIL_SQL';
    const clean = sanitizeObservabilityEvent(
      {
        message: privateValue,
        user: { email: privateValue },
        request: { url: privateValue },
        extra: { cause: { transcript: privateValue } },
        breadcrumbs: [{ message: privateValue }],
        exception: {
          values: [
            {
              type: 'TypeError',
              value: privateValue,
              stacktrace: {
                frames: [
                  {
                    filename: '/Users/private/src/main.ts',
                    function: 'bootstrap',
                    lineno: 4,
                    vars: { token: privateValue },
                    context_line: privateValue,
                  },
                  { filename: `https://example.com/private?token=${privateValue}` },
                ],
              },
            },
          ],
        },
      },
      metadata,
    );
    expect(JSON.stringify(clean)).not.toContain(privateValue);
    expect(clean).toMatchObject({
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'UNEXPECTED_ERROR',
            stacktrace: { frames: [{ filename: 'src/main.ts', function: 'bootstrap', lineno: 4 }] },
          },
        ],
      },
    });
    expect(JSON.stringify(clean)).not.toContain('/Users/private');
  });
  it('never exports protected stack or arbitrary request identifiers', () => {
    const clean = sanitizeObservabilityEvent(
      {
        exception: {
          values: [{ stacktrace: { frames: [{ filename: 'src/audit.ts', lineno: 5 }] } }],
        },
        tags: { requestId: 'PRIVATE_CANARY', protected: 'true' },
      },
      metadata,
    );
    expect(clean).not.toHaveProperty('exception');
    expect(JSON.stringify(clean)).not.toContain('PRIVATE_CANARY');
    expect(clean).toMatchObject({ message: 'BACKOFFICE_INTERNAL_ERROR' });
  });
  it('distinguishes expected rejection, cancellation and caught provider outages', () => {
    expect(classifyObservabilityError({ code: 'ROOM_FULL' }, 409)).toBeNull();
    expect(classifyObservabilityError({ code: 'ASSISTANCE_PROVIDER_TIMEOUT' }, 504)).toBe(
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(classifyObservabilityError({ name: 'AbortError' })).toBeNull();
    expect(classifyObservabilityError(new TypeError('private'))).toBe('UNEXPECTED_ERROR');
  });
  it('rejects untrusted identifiers, metadata and ingest configuration', () => {
    expect(validRequestId('a1b2c3d4-e5f6-4abc-8def-123456789abc')).toBe(true);
    expect(validRequestId('user@example.com')).toBe(false);
    expect(sanitizeObservabilityEvent({}, { ...metadata, release: 'PRIVATE_CANARY' })).toBeNull();
    expect(
      sanitizeObservabilityEvent({}, { ...metadata, release: 'slogan-mobile@abcdef123456' }),
    ).toBeNull();
    expect(validSentryDsn('https://0123456789abcdef@o123.ingest.us.sentry.io/123')).toBe(true);
    expect(validSentryDsn('https://0123456789abcdef:secret@o123.ingest.us.sentry.io/123')).toBe(
      false,
    );
  });
  it('bounds a burst and resumes after the window', () => {
    const limit = new ObservabilityRateLimit(2);
    expect([limit.allow(100_000), limit.allow(100_001), limit.allow(100_002)]).toEqual([
      true,
      true,
      false,
    ]);
    expect(limit.allow(160_000)).toBe(true);
  });
});
