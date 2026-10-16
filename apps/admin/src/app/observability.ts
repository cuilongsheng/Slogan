import * as Sentry from '@sentry/react';
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
import { configureAdminTracing, clearAdminTraceContext } from './tracing';

const enabled = import.meta.env.VITE_OBSERVABILITY_ENABLED === 'true';
const metadata: ObservabilityMetadata = {
  service: 'admin',
  platform: 'web',
  environment: import.meta.env.VITE_OBSERVABILITY_ENVIRONMENT,
  release: import.meta.env.VITE_OBSERVABILITY_RELEASE ?? '',
  build: import.meta.env.VITE_OBSERVABILITY_BUILD ?? '',
};
const limiter = new ObservabilityRateLimit();
let captured = new WeakSet<object>();

if (enabled) {
  if (!validObservabilityMetadata(metadata) || !validSentryDsn(import.meta.env.VITE_SENTRY_DSN))
    throw new Error('Invalid observability configuration');
  Sentry.init({
    debug: false,
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: metadata.environment,
    release: metadata.release,
    dist: metadata.build,
    tracesSampleRate: tracingSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE),
    defaultIntegrations: false,
    integrations: [Sentry.globalHandlersIntegration(), Sentry.browserApiErrorsIntegration()],
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
    },
    maxBreadcrumbs: 0,
    sendClientReports: false,
    beforeBreadcrumb: () => null,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    beforeSendSpan: (span) => {
      const clean = sanitizePerformanceSpan(span);
      clean.attributes = {
        ...(clean.attributes as object),
        'sentry.environment': metadata.environment,
        'sentry.release': metadata.release,
      };
      return clean as unknown as typeof span;
    },
    beforeSend: (event, hint) => {
      hint.attachments = [];
      const code = event.tags?.resultCode
        ? undefined
        : classifyObservabilityError(hint.originalException);
      if (code === null) return null;
      return limiter.allow()
        ? (sanitizeObservabilityEvent(event, metadata, {
            ...(code ? { code } : {}),
            protected: /\/(?:audit|login|roles|cases|appeals|users)(?:\/|$)/.test(
              window.location.pathname,
            ),
          }) as Sentry.ErrorEvent | null)
        : null;
    },
  });
  if (tracingSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) > 0)
    configureAdminTracing(Sentry);
}

export function reportAdminError(
  error: unknown,
  context: ObservabilityContext = {},
  status?: number,
) {
  if (!enabled) return;
  const code = context.code ?? classifyObservabilityError(error, status);
  if (!code) return;
  if (error && typeof error === 'object') {
    if (captured.has(error)) return;
    captured.add(error);
  }
  try {
    Sentry.withScope((scope) => {
      scope.setTag('resultCode', code);
      if (context.protected) scope.setTag('protected', 'true');
      if (context.requestId) scope.setTag('requestId', context.requestId);
      if (context.stage) scope.setTag('stage', context.stage);
      Sentry.captureException(error);
    });
  } catch {
    /* reporting cannot change the request result */
  }
}

export function clearAdminObservability() {
  clearAdminTraceContext();
  captured = new WeakSet();
  if (enabled) {
    const scope = Sentry.getCurrentScope();
    scope.setUser(null);
    scope.clearBreadcrumbs();
    scope.clearAttachments();
  }
}
export const adminReactErrorHandlers = enabled
  ? {
      onUncaughtError: (error: unknown) => reportAdminError(error, { stage: 'render' }),
      onCaughtError: (error: unknown) => reportAdminError(error, { stage: 'render' }),
      onRecoverableError: (error: unknown) => reportAdminError(error, { stage: 'render' }),
    }
  : {};

export async function observeAdminFetch(
  operation: () => Promise<Response>,
  protectedRequest = false,
): Promise<Response> {
  try {
    const response = await operation();
    if (response.status >= 500)
      reportAdminError(
        { code: 'HTTP_SERVER_ERROR' },
        {
          code: 'HTTP_SERVER_ERROR',
          requestId: response.headers.get('x-request-id') ?? undefined,
          protected: protectedRequest,
          stage: 'http',
        },
        response.status,
      );
    return response;
  } catch (error) {
    if (classifyObservabilityError(error) !== null)
      reportAdminError(error, {
        code: 'NETWORK_UNAVAILABLE',
        protected: protectedRequest,
        stage: 'http',
      });
    throw error;
  }
}
