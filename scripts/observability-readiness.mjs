import { pathToFileURL } from 'node:url';
import { buildMetadata } from './observability-build.mjs';

export function observabilityReadiness(app, env = process.env) {
  if (!['api', 'admin', 'mobile'].includes(app)) throw new Error('Choose api, admin or mobile');
  const prefix = app === 'admin' ? 'VITE_' : app === 'mobile' ? 'EXPO_PUBLIC_' : '';
  const required = [
    `${prefix}SENTRY_DSN`,
    `${prefix}OBSERVABILITY_ENVIRONMENT`,
    'SENTRY_ORG',
    'SENTRY_PROJECT',
    'SENTRY_AUTH_TOKEN',
  ];
  let readyForSourceUpload = false;
  try {
    readyForSourceUpload = buildMetadata(app, env, '0'.repeat(40)).enabled;
  } catch {
    // Report field names and a fixed status, never rejected input values.
  }
  return {
    app,
    scope: 'current command environment only',
    missing: required.filter((name) => !env[name]?.trim()),
    runtimeEnabled:
      app === 'api' ? Boolean(env.SENTRY_DSN) : env[`${prefix}OBSERVABILITY_ENABLED`] === 'true',
    readyForSourceUpload,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = observabilityReadiness(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.readyForSourceUpload) process.exitCode = 1;
  } catch {
    console.error('Invalid observability readiness target');
    process.exitCode = 1;
  }
}
