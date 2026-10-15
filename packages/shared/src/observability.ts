/** Platform-free, allowlist-only policy. No provider SDK or runtime globals. */
export const OBSERVABILITY_CODES = [
  'UNEXPECTED_ERROR',
  'DEPENDENCY_UNAVAILABLE',
  'HTTP_SERVER_ERROR',
  'NETWORK_UNAVAILABLE',
  'VOICE_CONNECT_FAILED',
  'VOICE_RECONNECT_FAILED',
  'VOICE_DISCONNECTED',
  'VOICE_TRACK_SUBSCRIPTION_FAILED',
  'WORKER_FAILED',
  'QUEUE_TASK_FAILED',
  'RECOVERY_FAILED',
  'BACKOFFICE_INTERNAL_ERROR',
  'NATIVE_CRASH',
] as const;
export type ObservabilityCode = (typeof OBSERVABILITY_CODES)[number];
export type ObservabilityService =
  'admin' | 'mobile' | 'api' | 'realtime' | 'operations' | 'monitor' | 'auth-mail' | 'room-speech';
export interface ObservabilityMetadata {
  environment: 'production' | 'preview' | 'test' | 'development';
  release: string;
  build: string;
  service: ObservabilityService;
  platform: 'web' | 'android' | 'ios' | 'node';
}
export interface ObservabilityContext {
  code?: ObservabilityCode;
  requestId?: string | undefined;
  stage?: 'http' | 'render' | 'connect' | 'reconnect' | 'subscribe' | 'worker' | 'recovery';
  durationMs?: number;
  protected?: boolean;
}
type Fields = Record<string, unknown>;
const object = (value: unknown): Fields =>
  value && typeof value === 'object' ? (value as Fields) : {};
const codeSet = new Set<string>(OBSERVABILITY_CODES);
const errorTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
]);
const stages = new Set([
  'http',
  'render',
  'connect',
  'reconnect',
  'subscribe',
  'worker',
  'recovery',
]);
const services = new Set([
  'admin',
  'mobile',
  'api',
  'realtime',
  'operations',
  'monitor',
  'auth-mail',
  'room-speech',
]);

export function validRequestId(value: unknown): value is string {
  // Arbitrary incoming identifiers can contain private content even if URL-safe.
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function validObservabilityMetadata(value: ObservabilityMetadata): boolean {
  return (
    ['production', 'preview', 'test', 'development'].includes(value.environment) &&
    services.has(value.service) &&
    ['web', 'android', 'ios', 'node'].includes(value.platform) &&
    /^slogan-(admin|mobile|api)@[0-9a-f]{7,40}$/.test(value.release) &&
    value.release.startsWith(
      `slogan-${value.service === 'admin' || value.service === 'mobile' ? value.service : 'api'}@`,
    ) &&
    /^[0-9a-f]{7,40}(?:\.[0-9]{1,12})?$/.test(value.build)
  );
}

export function validSentryDsn(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^https:\/\/[0-9a-f]{16,64}@(?:[a-z0-9-]+\.)*ingest(?:\.[a-z]+)?\.sentry\.io\/[0-9]+$/.test(
      value,
    )
  );
}

export function classifyObservabilityError(
  error: unknown,
  status?: number,
): ObservabilityCode | null {
  const fields = object(error);
  if (fields.name === 'AbortError') return null;
  const code = typeof fields.code === 'string' ? fields.code : '';
  if (
    /(?:PROVIDER_(?:UNAVAILABLE|TIMEOUT|RESPONSE_INVALID)|AUTH_UNAVAILABLE|REQUEST_FAILED|REALTIME_PROVIDER_UNAVAILABLE|ROOM_SPEECH_UNAVAILABLE)$/.test(
      code,
    )
  )
    return 'DEPENDENCY_UNAVAILABLE';
  if (status !== undefined) return status >= 500 ? 'HTTP_SERVER_ERROR' : null;
  // Public business codes are not exception telemetry. Transport supplies status for HTTP.
  if (code) return codeSet.has(code) ? (code as ObservabilityCode) : null;
  return 'UNEXPECTED_ERROR';
}

function safeFrame(input: unknown): Fields | null {
  const frame = object(input);
  const filename = typeof frame.filename === 'string' ? frame.filename : '';
  let safeFilename: string | undefined;
  // Only build/source locations, never general page/request URLs or query strings.
  if (
    /^(?:https:\/\/[a-z0-9.-]+)?\/(?:assets\/|_expo\/static\/js\/)[a-zA-Z0-9_./-]+\.(?:js|hbc)$/.test(
      filename,
    )
  )
    safeFilename = filename;
  else if (/^app:\/\/\/[a-zA-Z0-9_.-]+\.(?:bundle|js|hbc)$/.test(filename)) safeFilename = filename;
  else if (
    /^(?:(?:app|apps|src|dist|packages)\/)[a-zA-Z0-9_./-]+\.(?:js|ts|tsx|jsx)$/.test(filename)
  )
    safeFilename = filename;
  else if (/^(?:app|index)(?:\.[a-z0-9-]+)?\.(?:bundle|js|hbc)$/.test(filename))
    safeFilename = filename;
  else if (
    /^(?:file:\/\/)?[^?#]*\/(?:dist|src)\/[a-zA-Z0-9_./-]+\.(?:js|ts|tsx|jsx)$/.test(filename)
  ) {
    safeFilename = filename.slice(
      filename.lastIndexOf('/dist/') >= 0
        ? filename.lastIndexOf('/dist/') + 1
        : filename.lastIndexOf('/src/') + 1,
    );
  }
  if (!safeFilename) return null;
  const result: Fields = { filename: safeFilename };
  if (
    typeof frame.function === 'string' &&
    /^[a-zA-Z_$][a-zA-Z0-9_.$ <>-]{0,120}$/.test(frame.function)
  )
    result.function = frame.function;
  for (const key of ['lineno', 'colno'])
    if (
      typeof frame[key] === 'number' &&
      Number.isSafeInteger(frame[key]) &&
      (frame[key] as number) >= 0
    )
      result[key] = frame[key];
  if (typeof frame.in_app === 'boolean') result.in_app = frame.in_app;
  return result;
}

/** Constructs a fresh event: unknown fields and nested content cannot survive. */
export function sanitizeObservabilityEvent(
  input: unknown,
  metadata: ObservabilityMetadata,
  context: ObservabilityContext = {},
): Fields | null {
  if (!validObservabilityMetadata(metadata)) return null;
  const event = object(input);
  const tags = object(event.tags);
  const code =
    context.code ??
    (typeof tags.resultCode === 'string' && codeSet.has(tags.resultCode)
      ? (tags.resultCode as ObservabilityCode)
      : 'UNEXPECTED_ERROR');
  if (!codeSet.has(code)) return null;
  const rawExceptions = object(event.exception).values;
  const protectedFrame =
    Array.isArray(rawExceptions) &&
    rawExceptions.some((value) => {
      const frames = object(object(value).stacktrace).frames;
      return (
        Array.isArray(frames) &&
        frames.some(
          (frame) =>
            typeof object(frame).filename === 'string' &&
            /(?:\/|^)(?:backoffice|audit)(?:\/|\.)/.test(object(frame).filename as string),
        )
      );
    });
  const protectedEvent =
    context.protected === true ||
    tags.protected === 'true' ||
    tags['slogan.protected'] === true ||
    protectedFrame;
  const cleanTags: Fields = {
    service: metadata.service,
    platform: metadata.platform,
    resultCode: protectedEvent ? 'BACKOFFICE_INTERNAL_ERROR' : code,
    build: metadata.build,
  };
  const requestId = context.requestId ?? tags.requestId;
  if (validRequestId(requestId)) cleanTags.requestId = requestId;
  const stage = context.stage ?? tags.stage;
  if (typeof stage === 'string' && stages.has(stage)) cleanTags.stage = stage;
  const result: Fields = {
    environment: metadata.environment,
    release: metadata.release,
    dist: metadata.build,
    level: 'error',
    message: protectedEvent ? 'BACKOFFICE_INTERNAL_ERROR' : code,
    tags: cleanTags,
  };
  if (typeof event.event_id === 'string' && /^[0-9a-f]{32}$/.test(event.event_id))
    result.event_id = event.event_id;
  if (typeof event.timestamp === 'number' && Number.isFinite(event.timestamp))
    result.timestamp = event.timestamp;
  if (protectedEvent) return result;
  const trace = object(object(event.contexts).trace);
  if (
    typeof trace.trace_id === 'string' &&
    /^[0-9a-f]{32}$/.test(trace.trace_id) &&
    typeof trace.span_id === 'string' &&
    /^[0-9a-f]{16}$/.test(trace.span_id)
  ) {
    result.contexts = { trace: { trace_id: trace.trace_id, span_id: trace.span_id } };
  }
  const durationMs = context.durationMs ?? object(event.extra).durationMs;
  if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0)
    result.extra = { durationMs: Math.min(Math.round(durationMs), 86_400_000) };
  const values = object(event.exception).values;
  if (Array.isArray(values)) {
    const exceptions = values.slice(-1).map((value) => {
      const exception = object(value);
      const rawFrames = object(exception.stacktrace).frames;
      const frames = Array.isArray(rawFrames)
        ? rawFrames
            .slice(-30)
            .map(safeFrame)
            .filter((frame) => frame !== null)
        : [];
      return {
        type:
          typeof exception.type === 'string' && errorTypes.has(exception.type)
            ? exception.type
            : 'Error',
        value: code,
        ...(frames.length ? { stacktrace: { frames } } : {}),
      };
    });
    if (exceptions.length) result.exception = { values: exceptions };
  }
  // Debug IDs relate to build artifacts only, never dynamic event content.
  const images = object(event.debug_meta).images;
  if (Array.isArray(images)) {
    const cleanImages = images.slice(0, 20).flatMap((image) => {
      const fields = object(image);
      const frame = safeFrame({ filename: fields.code_file });
      return fields.type === 'sourcemap' &&
        typeof fields.debug_id === 'string' &&
        validRequestId(fields.debug_id) &&
        frame
        ? [{ type: 'sourcemap', debug_id: fields.debug_id, code_file: frame.filename }]
        : [];
    });
    if (cleanImages.length) result.debug_meta = { images: cleanImages };
  }
  return result;
}

export class ObservabilityRateLimit {
  private startedAt = 0;
  private count = 0;
  constructor(private readonly perMinute = 30) {}
  allow(now = Date.now()): boolean {
    if (now - this.startedAt >= 60_000) {
      this.startedAt = now;
      this.count = 0;
    }
    if (this.count >= this.perMinute) return false;
    this.count += 1;
    return true;
  }
}
