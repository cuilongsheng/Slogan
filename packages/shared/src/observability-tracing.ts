/** No SDK or runtime globals: shared policy for the Node/browser/native adapters. */
type Fields = Record<string, unknown>;
const record = (value: unknown): Fields =>
  value && typeof value === 'object' ? (value as Fields) : {};

export function tracingSampleRate(value: string | undefined): number {
  const rate = value === undefined ? 0.1 : Number(value);
  if (value?.trim() === '' || !Number.isFinite(rate) || rate < 0 || rate > 1)
    throw new Error('Invalid tracing sample rate');
  return rate;
}

export function validTraceTemplate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\/v1(?:\/[a-zA-Z0-9_{}:.-]+)*$/.test(value) &&
    value.length <= 200
  );
}

/** Only use schemaPath supplied by the generated API client, never an actual URL as a name. */
export function traceableApiRequest(
  url: { origin: string; pathname: string; username?: string; password?: string },
  apiOrigin: string,
  schemaPath: unknown,
): boolean {
  try {
    if (url.origin !== apiOrigin || url.username || url.password || !validTraceTemplate(schemaPath))
      return false;
    const path = schemaPath.split('/');
    const actual = url.pathname.split('/');
    return (
      path.length === actual.length &&
      path.every((part, index) =>
        /^\{[a-zA-Z][a-zA-Z0-9_]*\}$/.test(part) ? actual[index] !== '' : part === actual[index],
      )
    );
  } catch {
    return false;
  }
}

export function sanitizeTraceHeaders(input: unknown): Record<string, string> {
  const values = record(input);
  const trace = values['sentry-trace'];
  if (typeof trace !== 'string' || !/^[0-9a-f]{32}-[0-9a-f]{16}-[01]$/.test(trace)) return {};
  const clean: Record<string, string> = { 'sentry-trace': trace };
  const baggage = values.baggage;
  if (typeof baggage === 'string' && baggage.length <= 2048) {
    const allowed = baggage
      .split(',')
      .map((part) => part.trim())
      .filter((part) =>
        /^sentry-(?:trace_id=[0-9a-f]{32}|public_key=[0-9a-f]{16,64}|org_id=\d+|sampled=(?:true|false)|sample_rate=(?:0(?:\.\d+)?|1(?:\.0+)?))$/.test(
          part,
        ),
      );
    if (allowed.length) clean.baggage = allowed.join(',');
  }
  return clean;
}

/** SDK 10 uses data/op/description; SDK 11 streams attributes/name. */
export function sanitizePerformanceSpan(input: unknown): Fields {
  const span = record(input);
  const streaming = span.attributes !== undefined;
  const attrs = record(streaming ? span.attributes : span.data);
  const op = attrs['sentry.op'] ?? span.op;
  const operation =
    typeof op === 'string' &&
    ['http.client', 'voice.connect', 'voice.reconnect', 'voice.quality'].includes(op)
      ? op
      : 'operation';
  const route = attrs['http.route'];
  const method = attrs['http.request.method'];
  const validMethod =
    typeof method === 'string' && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(method);
  const data: Fields = { 'sentry.op': operation };
  const name =
    operation === 'http.client' && validTraceTemplate(route) && validMethod
      ? `${method} ${route}`
      : operation;
  if (operation === 'http.client' && validTraceTemplate(route) && validMethod) {
    data['http.route'] = route;
    data['http.request.method'] = method;
    const status = attrs['http.response.status_code'];
    if (Number.isInteger(status) && Number(status) >= 100 && Number(status) <= 599)
      data['http.response.status_code'] = status;
  }
  if (['excellent', 'good', 'poor', 'lost', 'unknown'].includes(String(attrs['voice.quality'])))
    data['voice.quality'] = attrs['voice.quality'];
  if (['ok', 'error', 'cancelled'].includes(String(attrs['slogan.result'])))
    data['slogan.result'] = attrs['slogan.result'];
  const result: Fields = {};
  for (const [key, length] of [
    ['trace_id', 32],
    ['span_id', 16],
    ['parent_span_id', 16],
  ] as const)
    if (typeof span[key] === 'string' && new RegExp(`^[0-9a-f]{${length}}$`).test(span[key]))
      result[key] = span[key];
  for (const key of ['start_timestamp', 'timestamp', 'end_timestamp'])
    if (typeof span[key] === 'number' && Number.isFinite(span[key])) result[key] = span[key];
  if (streaming) {
    result.name = name;
    result.attributes = data;
    if (typeof span.is_segment === 'boolean') result.is_segment = span.is_segment;
    result.status =
      attrs['slogan.result'] === 'cancelled' ? 'ok' : span.status === 'error' ? 'error' : 'ok';
  } else {
    result.op = operation;
    result.description = name;
    result.data = data;
    if (['ok', 'internal_error', 'cancelled', 'unknown_error'].includes(String(span.status)))
      result.status = attrs['slogan.result'] === 'cancelled' ? 'ok' : span.status;
  }
  return result;
}
