export interface SentryConfiguration {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  release?: string;
}

/** Parse before Nest imports; never include configuration values in errors. */
export function readSentryConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): SentryConfiguration | undefined {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return undefined;
  try {
    const url = new URL(dsn);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      !url.username ||
      url.password ||
      !/^\/\d+$/.test(url.pathname) ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('Invalid SENTRY_DSN configuration');
  }
  const rawRate = env.SENTRY_TRACES_SAMPLE_RATE;
  const tracesSampleRate = rawRate === undefined ? 0.1 : Number(rawRate);
  if (
    rawRate?.trim() === '' ||
    !Number.isFinite(tracesSampleRate) ||
    tracesSampleRate < 0 ||
    tracesSampleRate > 1
  ) {
    throw new Error('SENTRY_TRACES_SAMPLE_RATE must be a number between 0 and 1');
  }
  const environment = env.NODE_ENV || env.VERCEL_ENV || 'development';
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(environment)) {
    throw new Error('Invalid Sentry environment configuration');
  }
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  return {
    dsn,
    environment,
    tracesSampleRate,
    ...(sha && /^[a-f\d]{40}$/i.test(sha) ? { release: `slogan-api@${sha}` } : {}),
  };
}
