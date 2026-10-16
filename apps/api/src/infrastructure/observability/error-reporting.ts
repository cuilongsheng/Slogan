import * as Sentry from '@sentry/nestjs';
import {
  classifyObservabilityError,
  sanitizeObservabilityEvent,
  validObservabilityMetadata,
  validSentryDsn,
  validRequestId,
  ObservabilityRateLimit,
  type ObservabilityContext,
  type ObservabilityMetadata,
  type ObservabilityService,
} from '@slogan/shared';

let metadata: ObservabilityMetadata | undefined;
let limiter = new ObservabilityRateLimit();
let flushTimeout = 2000;
let captured = new WeakMap<object, WeakSet<object>>();
let shuttingDown = false;

export function errorWasReported(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && captured.get(Sentry.getIsolationScope())?.has(error),
  );
}
export function markErrorReported(error: unknown): void {
  if (error && typeof error === 'object') {
    const scope = Sentry.getIsolationScope();
    const seen = captured.get(scope) ?? new WeakSet<object>();
    seen.add(error);
    captured.set(scope, seen);
  }
}
export function withErrorReportingScope<T>(operation: () => T): T {
  return Sentry.withIsolationScope(operation);
}

function exitAfterReporting(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stderr.write('unhandled_api_error\n');
  const timer = setTimeout(() => process.exit(1), flushTimeout);
  void flushErrors().finally(() => {
    clearTimeout(timer);
    process.exit(1);
  });
}

export function initializeErrorReporting(
  service: ObservabilityService,
  input: Record<string, string | undefined> = process.env,
  transport?: NonNullable<Parameters<typeof Sentry.init>[0]>['transport'],
): void {
  if (input.OBSERVABILITY_ENABLED !== 'true') return;
  const candidate: ObservabilityMetadata = {
    service,
    platform: 'node',
    environment: input.OBSERVABILITY_ENVIRONMENT as ObservabilityMetadata['environment'],
    release: input.OBSERVABILITY_RELEASE ?? '',
    build: input.OBSERVABILITY_BUILD ?? '',
  };
  if (!validObservabilityMetadata(candidate) || !validSentryDsn(input.SENTRY_DSN))
    throw new Error('Invalid observability configuration');
  const perMinute = Number(input.OBSERVABILITY_MAX_EVENTS_PER_MINUTE ?? 30);
  flushTimeout = Number(input.OBSERVABILITY_FLUSH_TIMEOUT_MS ?? 2000);
  if (
    !Number.isInteger(perMinute) ||
    perMinute < 1 ||
    perMinute > 1000 ||
    !Number.isInteger(flushTimeout) ||
    flushTimeout < 100 ||
    flushTimeout > 2000
  )
    throw new Error('Invalid observability limits');
  metadata = candidate;
  limiter = new ObservabilityRateLimit(perMinute);
  captured = new WeakMap();
  shuttingDown = false;
  Sentry.init({
    dsn: input.SENTRY_DSN,
    environment: candidate.environment,
    release: candidate.release,
    dist: candidate.build,
    defaultIntegrations: false,
    integrations: [
      {
        name: 'SloganProcessErrors',
        setup(client) {
          // Stock rejection handlers can print the original exception. Keep the
          // Node fatal outcome, with only a fixed log and bounded sanitized flush.
          const handle = (error: unknown) => {
            if (Sentry.getClient() !== client || client.getOptions().enabled === false) return;
            reportError(error);
            exitAfterReporting();
          };
          process.on('uncaughtException', handle);
          process.on('unhandledRejection', handle);
        },
      },
    ],
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
    includeServerName: false,
    sendClientReports: false,
    maxBreadcrumbs: 0,
    ...(transport ? { transport } : {}),
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    beforeBreadcrumb: () => null,
    beforeSend: (event, hint) => {
      hint.attachments = [];
      if (!metadata || !limiter.allow()) return null;
      const code = event.tags?.resultCode
        ? undefined
        : classifyObservabilityError(hint.originalException);
      if (code === null) return null;
      return sanitizeObservabilityEvent(
        event,
        metadata,
        code ? { code } : {},
      ) as Sentry.ErrorEvent | null;
    },
  });
}

export function reportError(
  error: unknown,
  context: ObservabilityContext = {},
  status?: number,
): void {
  // HTTP already initialized the official SDK in src/instrument.ts. Captured
  // provider failures reuse it; never initialize a second client or filter.
  if (!Sentry.getClient() || Sentry.getClient()?.getOptions().enabled === false) return;
  try {
    const code = context.code ?? classifyObservabilityError(error, status);
    if (!code) return;
    if (error && typeof error === 'object') {
      if (errorWasReported(error)) return;
      markErrorReported(error);
    }
    const stack =
      !context.protected && error instanceof Error
        ? Sentry.defaultStackParser(error.stack ?? '')
        : [];
    // Retain code paths until the SDK attaches artifact Debug IDs. The final
    // beforeSend allowlist runs before buffering/transport; original messages
    // and causes never enter this event.
    Sentry.captureEvent({
      message: code,
      tags: {
        resultCode: code,
        ...(context.protected ? { protected: 'true' } : {}),
        ...(validRequestId(context.requestId) ? { requestId: context.requestId } : {}),
        ...(context.stage ? { stage: context.stage } : {}),
      },
      ...(!context.protected
        ? {
            exception: {
              values: [
                {
                  type: error instanceof Error ? error.name : 'Error',
                  value: code,
                  stacktrace: { frames: stack },
                },
              ],
            },
          }
        : {}),
      ...(context.durationMs !== undefined ? { extra: { durationMs: context.durationMs } } : {}),
    });
  } catch {
    /* Observability must never replace the business exception. */
  }
}

export async function flushErrors(): Promise<void> {
  if (!Sentry.getClient() || Sentry.getClient()?.getOptions().enabled === false) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Sentry.flush(flushTimeout),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, flushTimeout);
      }),
    ]);
  } catch {
    /* bounded, best effort */
  } finally {
    if (timer) clearTimeout(timer);
  }
}
