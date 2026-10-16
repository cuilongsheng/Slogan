import { loadEnvFile } from 'node:process';
import * as Sentry from '@sentry/nestjs';

import { readSentryConfiguration } from './config/sentry.js';
import { createSentryOptions } from './infrastructure/observability/sentry-options.js';

// ConfigModule loads these too, but Sentry must initialize before Nest's imports.
if (process.env.NODE_ENV !== 'test') {
  for (const path of ['apps/api/.env', '.env']) {
    try {
      loadEnvFile(path);
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
        // eslint-disable-next-line preserve-caught-error
        throw new Error('Unable to load application environment');
      }
    }
  }
}
const configuration = readSentryConfiguration();
if (configuration) Sentry.init(createSentryOptions(configuration));
