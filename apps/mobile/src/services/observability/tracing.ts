import type * as SDK from '@sentry/react-native';
import type * as CoreSDK from '@sentry/core';
import { traceableApiRequest, sanitizeTraceHeaders } from '@slogan/shared';
let sdk: typeof SDK | undefined;
let core: typeof CoreSDK | undefined;
let templates = new WeakMap<Request, string>();
export function configureMobileTracing(value: typeof SDK) {
  sdk = value;
}
export function clearMobileTraceContext() {
  templates = new WeakMap();
}
export function rememberMobileRequest(request: Request, schemaPath: string) {
  templates.set(request, schemaPath);
}

export async function traceMobileFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  execute: typeof fetch,
  apiOrigin: string,
): Promise<Response> {
  const template = typeof input === 'object' ? templates.get(input as Request) : undefined;
  if (!sdk?.startSpan || !template) return execute(input, init);
  const request = new Request(input instanceof Request ? input.clone() : input, init);
  if (!traceableApiRequest(new URL(request.url), new URL(apiOrigin).origin, template))
    return execute(input, init);
  let invoked = false;
  let outcome: { response: Response } | { error: unknown } | undefined;
  try {
    const response = await sdk.startSpan(
      {
        name: `${request.method} ${template}`,
        op: 'http.client',
        attributes: { 'http.route': template, 'http.request.method': request.method },
      },
      async (span) => {
        invoked = true;
        const headers = new Headers(request.headers);
        headers.delete('sentry-trace');
        headers.delete('baggage');
        try {
          // SDK core is loaded only for an enabled, traceable API request.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          core ??= require('@sentry/core') as typeof CoreSDK;
          for (const [name, value] of Object.entries(
            sanitizeTraceHeaders({
              'sentry-trace': core.spanToTraceHeader(span),
              baggage: core.spanToBaggageHeader(span),
            }),
          ))
            headers.set(name, value);
        } catch {
          /* Keep the request available if context extraction fails. */
        }
        try {
          // API contracts return JSON, never redirects. Fail closed instead of
          // forwarding technical correlation headers to an untrusted redirect.
          const response = await execute(request, { ...init, headers, redirect: 'error' });
          outcome = { response };
          try {
            span.setAttribute('http.response.status_code', response.status);
            span.setAttribute('slogan.result', response.status >= 500 ? 'error' : 'ok');
            span.setStatus({ code: response.status >= 500 ? 2 : 1 });
          } catch {
            /* best effort */
          }
          return response;
        } catch (error) {
          outcome = { error };
          try {
            span.setAttribute(
              'slogan.result',
              error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'error',
            );
          } catch {
            /* best effort */
          }
          throw error;
        }
      },
    );
    return invoked ? response : execute(input, init);
  } catch (error) {
    if (outcome && 'response' in outcome) return outcome.response;
    if (outcome && 'error' in outcome) throw outcome.error;
    if (invoked) throw error;
    return execute(input, init);
  }
}

export function beginVoiceTrace(stage: 'connect' | 'reconnect' | 'quality', quality?: string) {
  let ended = false;
  let span: ReturnType<typeof SDK.startInactiveSpan> | undefined;
  try {
    span = sdk?.startInactiveSpan({
      name: `voice.${stage}`,
      op: `voice.${stage}`,
      ...(quality && ['excellent', 'good', 'poor', 'lost', 'unknown'].includes(quality)
        ? { attributes: { 'voice.quality': quality } }
        : {}),
    });
  } catch {
    /* Monitoring cannot prevent a voice operation. */
  }
  return (result: 'ok' | 'error' | 'cancelled' = 'ok') => {
    if (ended) return;
    ended = true;
    try {
      span?.setAttribute('slogan.result', result);
      span?.setStatus({ code: result === 'error' ? 2 : 1 });
      span?.end();
    } catch {
      /* Monitoring cannot prevent cleanup or reconnection. */
    }
  };
}
