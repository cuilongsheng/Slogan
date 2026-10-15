import * as Sentry from '@sentry/nestjs';
import { fn } from 'jest-mock';
import { HttpException, type ArgumentsHost } from '@nestjs/common';

import { readSentryConfiguration } from '../../src/config/sentry.js';
import {
  createSentryOptions,
  sanitizeSentryError,
  sanitizeSentrySpan,
} from '../../src/infrastructure/observability/sentry-options.js';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter.js';
import { AppError } from '../../src/common/errors/app-error.js';

const dsn = 'https://fixture@o123.ingest.us.sentry.io/123';

describe('Sentry configuration', () => {
  it('disables initialization without DSN and defaults Preview to ten percent', () => {
    expect(readSentryConfiguration({})).toBeUndefined();
    expect(readSentryConfiguration({ SENTRY_DSN: dsn, VERCEL_ENV: 'preview' })).toMatchObject({
      environment: 'preview',
      tracesSampleRate: 0.1,
    });
  });
  it('prefers NODE_ENV, accepts zero and uses a valid commit SHA as release', () => {
    expect(
      readSentryConfiguration({
        SENTRY_DSN: dsn,
        SENTRY_TRACES_SAMPLE_RATE: '0',
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
      }),
    ).toMatchObject({
      environment: 'production',
      tracesSampleRate: 0,
      release: `slogan-api@${'a'.repeat(40)}`,
    });
    expect(readSentryConfiguration({ SENTRY_DSN: dsn })).not.toHaveProperty('release');
  });
  it.each(['', 'NaN', '-0.1', '1.1', 'Infinity', 'PRIVATE_CANARY'])(
    'rejects invalid rates without echoing values',
    (rate) => {
      expect(() =>
        readSentryConfiguration({ SENTRY_DSN: dsn, SENTRY_TRACES_SAMPLE_RATE: rate }),
      ).toThrow('SENTRY_TRACES_SAMPLE_RATE must be a number between 0 and 1');
    },
  );
  it('rejects invalid DSNs without echoing secrets', () => {
    expect(() => readSentryConfiguration({ SENTRY_DSN: 'PRIVATE_CANARY' })).toThrow(
      'Invalid SENTRY_DSN configuration',
    );
  });
});

describe('Sentry outbound privacy', () => {
  it('removes arbitrary error contents, request data and protected stack frames', () => {
    const event = {
      type: undefined,
      message: 'PRIVATE_CANARY',
      user: { email: 'PRIVATE_CANARY' },
      extra: { password: 'PRIVATE_CANARY' },
      request: { data: 'PRIVATE_CANARY' },
      tags: { 'slogan.protected': true },
      exception: {
        values: [
          {
            value: 'PRIVATE_CANARY',
            stacktrace: {
              frames: [{ filename: '/src/private.ts', vars: { transcript: 'PRIVATE_CANARY' } }],
            },
          },
        ],
      },
    };
    const sanitized = sanitizeSentryError(event);
    expect(JSON.stringify(sanitized)).not.toContain('PRIVATE_CANARY');
    expect(sanitized.exception?.values?.[0]).not.toHaveProperty('stacktrace');
  });
  it('retains only code frames outside protected requests', () => {
    const event = sanitizeSentryError({
      type: undefined,
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  filename: '/private/workspace/apps/api/src/main.ts',
                  lineno: 42,
                  vars: { token: 'PRIVATE_CANARY' },
                  pre_context: ['PRIVATE_CANARY'],
                },
              ],
            },
          },
        ],
      },
    });
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
      filename: 'app:///apps/api/src/main.ts',
      lineno: 42,
    });
    expect(JSON.stringify(event)).not.toContain('PRIVATE_CANARY');
  });
  it('preserves matching debug IDs and code filenames without protected source information', () => {
    const debugId = 'a1b2c3d4-e5f6-4abc-8def-123456789abc';
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            type: 'Error',
            stacktrace: { frames: [{ filename: '/var/task/apps/api/src/main.js', lineno: 12 }] },
          },
        ],
      },
      debug_meta: {
        images: [
          {
            type: 'sourcemap' as const,
            debug_id: debugId,
            code_file: '/var/task/apps/api/src/main.js',
          },
        ],
      },
    };
    const clean = sanitizeSentryError(event);
    expect(clean.debug_meta?.images?.[0]).toEqual({
      type: 'sourcemap',
      debug_id: debugId,
      code_file: 'app:///apps/api/src/main.js',
    });
    expect(clean.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe(
      'app:///apps/api/src/main.js',
    );
    expect(
      sanitizeSentryError({ ...event, tags: { 'slogan.protected': true } }),
    ).not.toHaveProperty('debug_meta');
  });
  it('removes SQL, links and free text from spans, keeping timing and fixed route templates', () => {
    const span = sanitizeSentrySpan({
      trace_id: 'a'.repeat(32),
      span_id: 'b'.repeat(16),
      name: 'PRIVATE_CANARY',
      start_timestamp: 1,
      end_timestamp: 2,
      status: 'ok',
      is_segment: true,
      attributes: {
        'sentry.op': 'http.server',
        'http.route': '/v1/rooms/:roomId',
        'http.request.method': 'GET',
        'db.query.text': 'PRIVATE_CANARY',
        'url.full': 'PRIVATE_CANARY',
        token: 'PRIVATE_CANARY',
      },
      links: [
        {
          trace_id: 'a'.repeat(32),
          span_id: 'b'.repeat(16),
          attributes: { secret: 'PRIVATE_CANARY' },
        },
      ],
    });
    expect(span.name).toBe('GET /v1/rooms/:roomId');
    expect(span.end_timestamp).toBe(2);
    expect(JSON.stringify(span)).not.toContain('PRIVATE_CANARY');
    expect(span).not.toHaveProperty('links');
  });
});

describe('existing filter with official Sentry capture', () => {
  const events: string[] = [];
  beforeEach(() => {
    events.length = 0;
    Sentry.init({
      ...createSentryOptions({ dsn, environment: 'test', tracesSampleRate: 0 }),
      defaultIntegrations: false,
      transport: () => ({
        send: async (envelope) => {
          events.push(JSON.stringify(envelope));
          return { statusCode: 200 };
        },
        flush: async () => true,
      }),
    });
  });
  afterEach(async () => {
    await Sentry.close(2000);
  });
  function harness(path = '/v1/rooms') {
    const response = { status: fn().mockReturnThis(), json: fn(), setHeader: fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ path, method: 'GET', id: 'fixture-id' }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    return { response, host, filter: new ApiExceptionFilter({ warn: fn(), error: fn() } as never) };
  }
  it('preserves 4xx responses without reporting expected denials', async () => {
    const { filter, response, host } = harness();
    filter.catch(new AppError('ROOM_FULL', 'Room is full', 409), host);
    filter.catch(new HttpException('Denied', 403), host);
    await Sentry.flush(2000);
    expect(response.status).toHaveBeenLastCalledWith(403);
    expect(events).toHaveLength(0);
  });
  it('captures plain errors and HttpException 5xx once each, without changing responses', async () => {
    const { filter, response, host } = harness();
    filter.catch(new Error('PRIVATE_CANARY'), host);
    filter.catch(new HttpException('PRIVATE_CANARY', 503), host);
    await Sentry.flush(2000);
    expect(response.status).toHaveBeenLastCalledWith(503);
    expect(events).toHaveLength(2);
    expect(events.join()).not.toContain('PRIVATE_CANARY');
  });
  it('suppresses protected stacks and never sends Logs or Application Metrics', async () => {
    const { filter, host } = harness('/v1/backoffice/audit');
    filter.catch(new Error('PRIVATE_CANARY'), host);
    Sentry.logger.info('PRIVATE_CANARY');
    Sentry.metrics.count('PRIVATE_CANARY', 1);
    await Sentry.flush(2000);
    expect(events).toHaveLength(1);
    expect(events.join()).not.toContain('PRIVATE_CANARY');
    expect(events.join()).not.toContain('stacktrace');
    const items = events.flatMap(
      (event) => JSON.parse(event)[1] as Array<[{ type: string }, unknown]>,
    );
    expect(items.every(([header]) => header.type === 'event')).toBe(true);
  });
});
