import { loadEnvFile } from 'node:process';

/** Same precedence as Nest config, loaded before SDK initialization. */
export function loadObservabilityEnvironment(): void {
  if (process.env.NODE_ENV === 'test') return;
  for (const path of ['apps/api/.env', '.env']) {
    try {
      loadEnvFile(path);
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT')
        // The original filesystem error may carry a private configuration path.
        // eslint-disable-next-line preserve-caught-error
        throw new Error('Unable to load application environment');
    }
  }
}
