import * as Sentry from '@sentry/nestjs';
import {
  initializeErrorReporting,
  reportError,
  flushErrors,
} from '../../src/infrastructure/observability/error-reporting.js';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter.js';
import { AppError } from '../../src/common/errors/app-error.js';
import type { ArgumentsHost } from '@nestjs/common';
import { fn } from 'jest-mock';

describe('actual Sentry transport privacy and business error boundary', () => {
  const events: string[] = [];
  beforeEach(() => {
    events.length = 0;
    initializeErrorReporting(
      'api',
      {
        OBSERVABILITY_ENABLED: 'true',
        OBSERVABILITY_ENVIRONMENT: 'test',
        OBSERVABILITY_RELEASE: 'slogan-api@abcdef123456',
        OBSERVABILITY_BUILD: 'abcdef123456',
        SENTRY_DSN: 'https://0123456789abcdef@o123.ingest.us.sentry.io/123',
      },
      () => ({
        send: async (envelope) => {
          events.push(JSON.stringify(envelope));
          return { statusCode: 200 };
        },
        flush: async () => true,
      }),
    );
  });
  afterEach(async () => {
    await Sentry.close();
  });
  it('sanitizes both explicit and automatically captured exceptions before transport', async () => {
    const error = new TypeError('PRIVATE_CANARY');
    reportError(error, { requestId: 'a1b2c3d4-e5f6-4abc-8def-123456789abc', stage: 'http' }, 500);
    reportError(error, {}, 500);
    Sentry.captureException(
      Object.assign(new Error('PRIVATE_CANARY'), { cause: { transcript: 'PRIVATE_CANARY' } }),
    );
    await flushErrors();
    expect(events).toHaveLength(2);
    expect(events.join()).not.toContain('PRIVATE_CANARY');
    expect(events.join()).toContain('a1b2c3d4-e5f6-4abc-8def-123456789abc');
  });
  it('retains response semantics while suppressing expected denial and protected stacks', async () => {
    const response = { status: fn().mockReturnThis(), json: fn(), setHeader: fn() };
    const http = {
      getRequest: () => ({
        path: '/v1/backoffice/audit',
        method: 'GET',
        id: 'a1b2c3d4-e5f6-4abc-8def-123456789abc',
      }),
      getResponse: () => response,
    };
    const host = { switchToHttp: () => http } as unknown as ArgumentsHost;
    const filter = new ApiExceptionFilter({ warn: fn(), error: fn() } as never);
    filter.catch(new AppError('BACKOFFICE_ACCESS_DENIED', 'denied', 403), host);
    filter.catch(new Error('PRIVATE_CANARY'), host);
    await flushErrors();
    expect(response.status).toHaveBeenLastCalledWith(500);
    expect(response.json).toHaveBeenLastCalledWith({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: 'a1b2c3d4-e5f6-4abc-8def-123456789abc',
    });
    expect(events).toHaveLength(1);
    expect(events.join()).not.toContain('PRIVATE_CANARY');
    const items = JSON.parse(events[0]!)[1] as Array<[unknown, Record<string, unknown>]>;
    expect(items[0]![1]).not.toHaveProperty('exception');
  });
  it('deduplicates provider plus filter capture within an operation, but not across operations', async () => {
    const failure = new Error('PRIVATE_CANARY');
    const response = { status: fn().mockReturnThis(), json: fn(), setHeader: fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ path: '/v1/rooms', method: 'GET' }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    const filter = new ApiExceptionFilter({ warn: fn(), error: fn() } as never);
    for (let index = 0; index < 2; index++) {
      Sentry.withIsolationScope(() => {
        reportError(failure);
        filter.catch(failure, host);
      });
    }
    await flushErrors();
    expect(events).toHaveLength(2);
  });
  it('keeps concurrent capture scopes separate without carrying private context', async () => {
    const ids = ['a1b2c3d4-e5f6-4abc-8def-123456789abc', 'b1b2c3d4-e5f6-4abc-8def-123456789abc'];
    await Promise.all(
      ids.map(async (requestId) => {
        await Promise.resolve();
        reportError(new Error('PRIVATE_CANARY'), { requestId });
      }),
    );
    await flushErrors();
    expect(events).toHaveLength(2);
    const observed = events.map((event) => JSON.parse(event)[1][0][1].tags.requestId).sort();
    expect(observed).toEqual(ids.sort());
  });
});
