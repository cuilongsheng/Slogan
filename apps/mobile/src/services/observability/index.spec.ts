import { sanitizeObservabilityEvent, type ObservabilityMetadata } from '@slogan/shared';
import type * as ObservabilityModule from './index';

const mockCapture = jest.fn();
const mockClear = jest.fn();
const mockTags: Record<string, string> = {};
const mockScope = {
  clear: mockClear,
  setTag: (key: string, value: string) => {
    mockTags[key] = value;
  },
  setExtra: jest.fn(),
};
const mockInit = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = () => require('./index') as typeof ObservabilityModule;
jest.mock('@sentry/react-native', () => ({
  init: mockInit,
  withScope: (callback: (scope: typeof mockScope) => void) => callback(mockScope),
  captureException: mockCapture,
  getCurrentScope: () => mockScope,
  wrapExpoRouterErrorBoundary: (value: unknown) => value,
}));

describe('Mobile final HTTP fault and logout isolation', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    for (const key of Object.keys(mockTags)) delete mockTags[key];
    process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED = 'true';
    process.env.EXPO_PUBLIC_OBSERVABILITY_ENVIRONMENT = 'test';
    process.env.EXPO_PUBLIC_OBSERVABILITY_RELEASE = 'slogan-mobile@abcdef123456';
    process.env.EXPO_PUBLIC_OBSERVABILITY_BUILD = 'abcdef123456';
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://0123456789abcdef@o123.ingest.us.sentry.io/123';
  });
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED;
  });
  it('ignores expected rejection and cancellation, uses only legal response correlation and clears account scope', async () => {
    const { observeMobileFetch, reportMobileError, clearMobileObservability } = load();
    const response = (status: number, id: string) =>
      ({ status, headers: { get: () => id } }) as unknown as Response;
    await observeMobileFetch(async () => response(401, 'PRIVATE_CANARY'));
    const abort = Object.assign(new Error('PRIVATE_CANARY'), { name: 'AbortError' });
    await expect(
      observeMobileFetch(async () => {
        throw abort;
      }),
    ).rejects.toBe(abort);
    expect(mockCapture).not.toHaveBeenCalled();
    await observeMobileFetch(async () => response(503, 'a1b2c3d4-e5f6-4abc-8def-123456789abc'));
    const event = sanitizeObservabilityEvent(
      { tags: mockTags, request: { body: 'PRIVATE_CANARY' } },
      {
        environment: 'test',
        service: 'mobile',
        platform: 'android',
        release: 'slogan-mobile@abcdef123456',
        build: 'abcdef123456',
      } satisfies ObservabilityMetadata,
    );
    expect(JSON.stringify(event)).toContain('a1b2c3d4-e5f6-4abc-8def-123456789abc');
    expect(JSON.stringify(event)).not.toContain('PRIVATE_CANARY');
    const error = new Error('PRIVATE_CANARY');
    reportMobileError(error);
    reportMobileError(error);
    expect(mockCapture).toHaveBeenCalledTimes(2);
    clearMobileObservability();
    reportMobileError(error);
    expect(mockCapture).toHaveBeenCalledTimes(3);
    expect(mockClear).toHaveBeenCalled();
  });
  it('cleans transaction roots as well as spans and never enables logs or metrics', () => {
    load();
    const options = mockInit.mock.calls[0]![0];
    expect(options.enableLogs).toBe(false);
    expect(options.enableMetrics).toBe(false);
    const transaction = options.beforeSendTransaction({
      event_id: 'a'.repeat(32),
      transaction: 'voice.quality',
      contexts: {
        trace: {
          trace_id: 'b'.repeat(32),
          span_id: 'c'.repeat(16),
          op: 'voice.quality',
          data: { 'voice.quality': 'poor', 'participant.identity': 'PRIVATE_CANARY' },
        },
        user: { id: 'PRIVATE_CANARY' },
      },
      user: { id: 'PRIVATE_CANARY' },
      extra: { raw: 'PRIVATE_CANARY' },
      request: { url: 'PRIVATE_CANARY' },
    });
    expect(JSON.stringify(transaction)).not.toContain('PRIVATE_CANARY');
    expect(transaction.contexts.trace.data['voice.quality']).toBe('poor');
    expect(options.beforeSendLog({ body: 'PRIVATE_CANARY' })).toBeNull();
    expect(options.beforeSendMetric({ name: 'PRIVATE_CANARY' })).toBeNull();
  });
  it('returns the original failure even when the SDK throws and retains the Router fallback when disabled', async () => {
    const { observeMobileFetch } = load();
    mockCapture.mockImplementationOnce(() => {
      throw new Error('SDK failure');
    });
    const failure = new Error('PRIVATE_CANARY');
    await expect(
      observeMobileFetch(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    jest.resetModules();
    process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED = 'false';
    const disabled = load();
    const boundary = () => null;
    expect(disabled.wrapRouterErrorBoundary(boundary)).toBe(boundary);
  });
});
