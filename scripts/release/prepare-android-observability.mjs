import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildMetadata, currentRevision, requireCleanRelease } from '../observability-build.mjs';

export function androidObservabilityEnvironment(input, revision) {
  if (input.GITHUB_REF !== 'refs/heads/main' || input.GITHUB_EVENT_NAME === 'pull_request')
    throw new Error('MONITORED_ANDROID_MAIN_REQUIRED');
  if (input.SLOGAN_RELEASE_COMMIT !== revision)
    throw new Error('MONITORED_ANDROID_REVISION_MISMATCH');
  const metadata = buildMetadata('mobile', input, revision);
  if (!metadata.enabled) throw new Error('MONITORED_ANDROID_CONFIGURATION_REQUIRED');
  return Object.fromEntries(
    Object.entries(metadata.env).filter(([key]) =>
      /^(EXPO_PUBLIC_OBSERVABILITY_(ENABLED|ENVIRONMENT|RELEASE|BUILD)|EXPO_PUBLIC_SENTRY_(DSN|TRACES_SAMPLE_RATE)|SENTRY_(ORG|PROJECT|RELEASE|DIST))$/.test(
        key,
      ),
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireCleanRelease();
    if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV_REQUIRED');
    const values = androidObservabilityEnvironment(process.env, currentRevision());
    if (Object.values(values).some((value) => /[\r\n]/.test(value)))
      throw new Error('INVALID_ANDROID_BUILD_METADATA');
    await appendFile(
      process.env.GITHUB_ENV,
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(''),
    );
    console.log('Prepared protected main Android monitoring metadata');
  } catch {
    console.error('Android monitoring configuration rejected');
    process.exitCode = 1;
  }
}
