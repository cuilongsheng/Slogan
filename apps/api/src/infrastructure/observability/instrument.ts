import { initializeErrorReporting } from './error-reporting.js';
import { loadObservabilityEnvironment } from './load-environment.js';
loadObservabilityEnvironment();

// Imported before Nest/provider modules at every real runtime entrypoint.
const name = process.env.APP_NAME ?? 'slogan-api';
initializeErrorReporting(
  name.includes('room-speech')
    ? 'room-speech'
    : name.includes('auth-mail')
      ? 'auth-mail'
      : name.includes('monitor')
        ? 'monitor'
        : name.includes('operations')
          ? 'operations'
          : name.includes('realtime')
            ? 'realtime'
            : 'api',
);
