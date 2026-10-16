import type * as SDK from '@sentry/react';
import { traceableApiRequest, sanitizeTraceHeaders } from '@slogan/shared';
let sdk: typeof SDK | undefined;
let templates = new WeakMap<Request, string>();
export function configureAdminTracing(value: typeof SDK) {
  sdk = value;
}
export function clearAdminTraceContext() {
  templates = new WeakMap();
}
export function rememberAdminRequest(request: Request, schemaPath: string) {
  templates.set(request, schemaPath);
}

export async function traceAdminFetch(
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
          for (const [name, value] of Object.entries(sanitizeTraceHeaders(sdk!.getTraceData())))
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
