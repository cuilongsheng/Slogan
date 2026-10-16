import type * as NativeSentrySdk from '@sentry/react-native';
import type { ErrorEvent as NativeErrorEvent } from '@sentry/react-native';
type NativeSentry = typeof NativeSentrySdk;
let Sentry: NativeSentry | undefined;
import { Platform } from 'react-native';
import {
  classifyObservabilityError,
  sanitizeObservabilityEvent,
  validObservabilityMetadata,
  validSentryDsn,
  ObservabilityRateLimit,
  type ObservabilityContext,
  type ObservabilityMetadata,
  tracingSampleRate,
  sanitizePerformanceSpan,
} from '@slogan/shared';
import { configureMobileTracing, clearMobileTraceContext } from './tracing';

const enabled = process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED === 'true';
const metadata: ObservabilityMetadata = {
  service: 'mobile',
  platform: Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android',
  environment: process.env
    .EXPO_PUBLIC_OBSERVABILITY_ENVIRONMENT as ObservabilityMetadata['environment'],
  release: process.env.EXPO_PUBLIC_OBSERVABILITY_RELEASE ?? '',
  build: process.env.EXPO_PUBLIC_OBSERVABILITY_BUILD ?? '',
};
const limiter = new ObservabilityRateLimit();
let captured = new WeakSet<object>();

if (enabled) {
  if (
    ['1', 'true'].includes(process.env.EXPO_PUBLIC_USE_RN_FETCH ?? '') &&
    tracingSampleRate(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE) > 0
  )
    throw new Error('Sampled API tracing requires Expo fetch redirect protection');
  if (!validObservabilityMetadata(metadata) || !validSentryDsn(process.env.EXPO_PUBLIC_SENTRY_DSN))
    throw new Error('Invalid observability configuration');
  // Load only when enabled; disabled builds/tests do not initialize native machinery.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require('@sentry/react-native') as NativeSentry;
  // Android is manually initialized with its cache-before-write privacy callback.
  // iOS native collection stays disabled until its equivalent release validation.
  Sentry.init({
    debug: false,
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: metadata.environment,
    release: metadata.release,
    dist: metadata.build,
    tracesSampleRate: tracingSampleRate(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
    enableNative: Platform.OS === 'android',
    autoInitializeNativeSdk: false,
    enableNativeCrashHandling: Platform.OS === 'android',
    enableNdk: false,
    enableNdkScopeSync: false,
    enableNativeFramesTracking: false,
    enableAppStartTracking: false,
    enableAutoSessionTracking: false,
    sendClientReports: false,
    enableLogs: false,
    enableMetrics: false,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    profilesSampleRate: 0,
    enableAutoConsoleLogs: false,
    enableNativeNagger: false,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    maxBreadcrumbs: 0,
    integrations: (integrations) =>
      integrations.filter((integration) =>
        [
          'ReactNativeErrorHandlers',
          'GlobalHandlers',
          'BrowserApiErrors',
          'RewriteFrames',
          'DebugMeta',
        ].includes(integration.name),
      ),
    beforeBreadcrumb: () => null,
    beforeSendSpan: (span) => sanitizePerformanceSpan(span) as unknown as typeof span,
    beforeSendTransaction: (event) => {
      // Transaction envelopes (SDK 10) have a separate callback from errors.
      const trace = event.contexts?.trace;
      return {
        type: 'transaction',
        ...(event.event_id === undefined ? {} : { event_id: event.event_id }),
        ...(event.start_timestamp === undefined ? {} : { start_timestamp: event.start_timestamp }),
        ...(event.timestamp === undefined ? {} : { timestamp: event.timestamp }),
        environment: metadata.environment,
        release: metadata.release,
        dist: metadata.build,
        transaction:
          typeof event.transaction === 'string' &&
          /^(?:voice\.(?:connect|reconnect|quality)|(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/v1(?:\/[a-zA-Z0-9_{}:.-]+)*)$/.test(
            event.transaction,
          )
            ? event.transaction
            : 'operation',
        contexts: trace
          ? {
              trace: {
                trace_id: trace.trace_id,
                span_id: trace.span_id,
                op: ['http.client', 'voice.connect', 'voice.reconnect', 'voice.quality'].includes(
                  trace.op ?? '',
                )
                  ? trace.op!
                  : 'operation',
                data: sanitizePerformanceSpan({ op: trace.op, data: trace.data }).data as Record<
                  string,
                  unknown
                >,
                ...(typeof trace.status === 'string' &&
                ['ok', 'internal_error', 'unknown_error', 'cancelled'].includes(trace.status)
                  ? { status: trace.data?.['slogan.result'] === 'cancelled' ? 'ok' : trace.status }
                  : {}),
              },
            }
          : {},
        ...(event.spans
          ? {
              spans: event.spans.map(
                (span) => sanitizePerformanceSpan(span) as unknown as typeof span,
              ),
            }
          : {}),
        tags: { service: 'mobile', platform: metadata.platform },
      };
    },
    beforeSend: (event, hint) => {
      hint.attachments = [];
      const code = event.tags?.resultCode
        ? undefined
        : classifyObservabilityError(hint.originalException);
      if (code === null) return null;
      return limiter.allow()
        ? (sanitizeObservabilityEvent(
            event,
            metadata,
            code ? { code } : {},
          ) as NativeErrorEvent | null)
        : null;
    },
  });
  if (tracingSampleRate(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE) > 0)
    configureMobileTracing(Sentry);
}

export function reportMobileError(
  error: unknown,
  context: ObservabilityContext = {},
  status?: number,
): void {
  if (!enabled || !Sentry) return;
  const code = context.code ?? classifyObservabilityError(error, status);
  if (!code) return;
  if (error && typeof error === 'object') {
    if (captured.has(error)) return;
    captured.add(error);
  }
  try {
    Sentry.withScope((scope) => {
      scope.clear();
      scope.setTag('resultCode', code);
      if (context.requestId) scope.setTag('requestId', context.requestId);
      if (context.stage) scope.setTag('stage', context.stage);
      if (context.durationMs !== undefined) scope.setExtra('durationMs', context.durationMs);
      if (context.protected) scope.setTag('protected', 'true');
      Sentry.captureException(error);
    });
  } catch {
    /* reporting cannot alter voice/session behavior */
  }
}
export function clearMobileObservability() {
  clearMobileTraceContext();
  captured = new WeakSet();
  if (enabled && Sentry) Sentry.getCurrentScope().clear();
}

export async function observeMobileFetch(operation: () => Promise<Response>): Promise<Response> {
  try {
    const response = await operation();
    if (response.status >= 500)
      reportMobileError(
        { code: 'HTTP_SERVER_ERROR' },
        {
          code: 'HTTP_SERVER_ERROR',
          requestId: response.headers.get('x-request-id') ?? undefined,
          stage: 'http',
        },
        response.status,
      );
    return response;
  } catch (error) {
    if (classifyObservabilityError(error) !== null)
      reportMobileError(error, { code: 'NETWORK_UNAVAILABLE', stage: 'http' });
    throw error;
  }
}

export function wrapRouterErrorBoundary<
  T extends Parameters<NativeSentry['wrapExpoRouterErrorBoundary']>[0],
>(component: T) {
  return enabled && Sentry ? Sentry.wrapExpoRouterErrorBoundary(component) : component;
}
