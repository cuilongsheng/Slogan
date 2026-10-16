import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { execFileSync } from 'node:child_process';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = mode === 'pages' ? process.env : { ...loadEnv(mode, '.', 'VITE_'), ...process.env };
  const monitored = env.VITE_OBSERVABILITY_ENABLED === 'true';
  if (monitored && execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim())
    throw new Error('Monitored releases require a clean source checkout');
  const revision = monitored
    ? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    : '';
  if (
    monitored &&
    (!process.env.SENTRY_AUTH_TOKEN || !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT)
  )
    throw new Error('Missing observability upload configuration');
  if (
    monitored &&
    (!['preview', 'production', 'test'].includes(env.VITE_OBSERVABILITY_ENVIRONMENT ?? '') ||
      !/^https:\/\/[0-9a-f]{16,64}@(?:[a-z0-9-]+\.)*ingest(?:\.[a-z]+)?\.sentry\.io\/[0-9]+$/.test(
        env.VITE_SENTRY_DSN ?? '',
      ) ||
      !/^[0-9a-f]{7,40}(?:\.[0-9]{1,12})?$/.test(env.VITE_OBSERVABILITY_BUILD ?? revision))
  )
    throw new Error('Invalid observability build configuration');
  return {
    envDir: mode === 'pages' ? false : '.',
    plugins: [
      react(),
      tailwindcss(),
      ...(monitored
        ? [
            sentryVitePlugin({
              org: process.env.SENTRY_ORG!,
              project: process.env.SENTRY_PROJECT!,
              authToken: process.env.SENTRY_AUTH_TOKEN!,
              telemetry: false,
              release: {
                name: `slogan-admin@${revision}`,
                dist: env.VITE_OBSERVABILITY_BUILD ?? revision,
                inject: true,
              },
              sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
              errorHandler: () => {
                throw new Error('Observability source map upload failed');
              },
            }),
          ]
        : []),
    ],
    build: { sourcemap: monitored ? 'hidden' : false },
    ...(monitored
      ? {
          define: {
            'import.meta.env.VITE_OBSERVABILITY_RELEASE': JSON.stringify(
              `slogan-admin@${revision}`,
            ),
            'import.meta.env.VITE_OBSERVABILITY_BUILD': JSON.stringify(
              env.VITE_OBSERVABILITY_BUILD ?? revision,
            ),
          },
        }
      : {}),
    server: {
      host: 'localhost',
      port: 4173,
    },
    preview: {
      host: 'localhost',
      port: 4173,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
