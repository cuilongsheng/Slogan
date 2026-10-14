import type * as Sentry from '@sentry/nestjs';
import { captureException, getClient, httpIntegration } from '@sentry/nestjs';

import type { SentryConfiguration } from '../../config/sentry.js';

type Options = NonNullable<Parameters<typeof Sentry.init>[0]>;
type Integration = Extract<Options['integrations'], unknown[]>[number];
type Span = Parameters<NonNullable<Options['beforeSendSpan']>>[0];
type Event = Parameters<NonNullable<Options['beforeSend']>>[0];

function operation(value: unknown): string {
  return typeof value === 'string' && /^[a-z_.]{1,60}$/.test(value) ? value : 'operation';
}

export function sanitizeSentrySpan(span: Span): Span {
  const op = operation(span.attributes['sentry.op']);
  const method = span.attributes['http.request.method'];
  const route = span.attributes['http.route'];
  const httpMethod =
    typeof method === 'string' && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(method)
      ? method
      : undefined;
  // Only instrumentation-provided route templates; never raw URLs or SQL descriptions.
  const httpRoute =
    typeof route === 'string' && /^\/[a-zA-Z_/:.-]{0,160}$/.test(route) ? route : undefined;
  const status = span.attributes['http.response.status_code'];
  return {
    trace_id: span.trace_id,
    span_id: span.span_id,
    ...(span.parent_span_id ? { parent_span_id: span.parent_span_id } : {}),
    name: httpMethod && httpRoute ? `${httpMethod} ${httpRoute}` : op,
    start_timestamp: span.start_timestamp,
    ...(span.end_timestamp === undefined ? {} : { end_timestamp: span.end_timestamp }),
    status: span.status,
    is_segment: span.is_segment,
    attributes: {
      'sentry.op': op,
      ...(httpMethod ? { 'http.request.method': httpMethod } : {}),
      ...(httpRoute ? { 'http.route': httpRoute } : {}),
      ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
        ? { 'http.response.status_code': status }
        : {}),
    },
  };
}

export function sanitizeSentryError(event: Event): Event {
  const protectedRequest = event.tags?.['slogan.protected'] === true;
  const trace = event.contexts?.trace;
  return {
    type: undefined,
    ...(event.event_id === undefined ? {} : { event_id: event.event_id }),
    ...(event.timestamp === undefined ? {} : { timestamp: event.timestamp }),
    platform: 'node',
    level: 'error',
    ...(event.environment === undefined ? {} : { environment: event.environment }),
    ...(event.release === undefined ? {} : { release: event.release }),
    tags: { service: 'slogan-api' },
    ...(!protectedRequest && trace
      ? {
          contexts: {
            trace: {
              trace_id: trace.trace_id,
              span_id: trace.span_id,
              op: operation(trace.op),
            },
          },
        }
      : {}),
    exception: {
      values: (event.exception?.values ?? []).map((value) => ({
        type: 'Error',
        value: 'Unexpected API failure',
        ...(value.mechanism
          ? {
              mechanism: {
                type:
                  value.mechanism.type === 'auto.node.process_error'
                    ? 'auto.node.process_error'
                    : 'auto.function.nestjs.exception_captured',
                handled: value.mechanism.handled ?? false,
              },
            }
          : {}),
        ...(!protectedRequest && value.stacktrace
          ? {
              stacktrace: {
                frames: (value.stacktrace.frames ?? []).flatMap((frame) => {
                  const filename = frame.filename?.replaceAll('\\', '/');
                  const path = filename?.match(
                    /\/(?:src|dist)\/([a-zA-Z0-9_./-]+\.[cm]?[jt]s)$/,
                  )?.[0];
                  if (!path) return [];
                  return [
                    {
                      filename: `app://${path}`,
                      ...(frame.lineno === undefined ? {} : { lineno: frame.lineno }),
                      ...(frame.colno === undefined ? {} : { colno: frame.colno }),
                      ...(frame.in_app === undefined ? {} : { in_app: frame.in_app }),
                      ...(frame.function && /^[a-zA-Z0-9_.$<> ]{1,120}$/.test(frame.function)
                        ? { function: frame.function }
                        : {}),
                    },
                  ];
                }),
              },
            }
          : {}),
      })),
    },
  };
}

/** Preserve fail-fast process behavior without SDK default raw console output. */
function safeProcessErrors(): Integration {
  return {
    name: 'SloganProcessErrors',
    setup(client) {
      let exiting = false;
      const terminate = (error: unknown) => {
        if (getClient() !== client) return;
        if (exiting) process.exit(1);
        exiting = true;
        captureException(error, {
          mechanism: { handled: false, type: 'auto.node.process_error' },
        });
        process.stderr.write('Fatal API error; shutting down\n');
        setTimeout(() => process.exit(1), 2000).unref();
        void client.flush(2000).then(
          () => process.exit(1),
          () => process.exit(1),
        );
      };
      process.on('uncaughtException', terminate);
      process.on('unhandledRejection', terminate);
    },
  };
}

export function createSentryOptions(config: SentryConfiguration) {
  return {
    ...config,
    debug: false,
    // SDK 11 uses the final callbacks below to discard Logs and Metrics.
    enableLogs: false,
    enableMetrics: false,
    profileSessionSampleRate: 0,
    includeServerName: false,
    sendClientReports: false,
    maxBreadcrumbs: 0,
    tracePropagationTargets: [],
    strictTraceContinuation: true,
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
    integrations: (defaults) => [
      ...defaults
        .filter((integration) =>
          ['Nest', 'Http', 'NodeFetch', 'Express', 'Postgres', 'Dedupe', 'EventFilters'].includes(
            integration.name,
          ),
        )
        .map((integration) =>
          integration.name === 'Http'
            ? httpIntegration({ sessions: false, breadcrumbs: false, tracePropagation: false })
            : integration,
        ),
      safeProcessErrors(),
    ],
    beforeSend: sanitizeSentryError,
    beforeSendSpan: (span) => {
      const clean = sanitizeSentrySpan(span);
      clean.attributes['sentry.environment'] = config.environment;
      if (config.release) clean.attributes['sentry.release'] = config.release;
      return clean;
    },
    beforeBreadcrumb: () => null,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
  } satisfies Options & { enableLogs: false; enableMetrics: false };
}
