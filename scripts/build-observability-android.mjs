import { fileURLToPath } from 'node:url';
import {
  buildMetadata,
  currentRevision,
  requireCleanRelease,
  runTool,
} from './observability-build.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = buildMetadata('mobile', process.env, currentRevision());
if (metadata.enabled) requireCleanRelease();
const env = { ...metadata.env, EXPO_NO_DOTENV: '1' };
runTool('pnpm', ['--filter', '@slogan/shared', 'build'], env);
runTool(
  'pnpm',
  [
    '--filter',
    '@slogan/mobile',
    'exec',
    'expo',
    'prebuild',
    '--platform',
    'android',
    '--no-install',
  ],
  env,
);
runTool('./gradlew', ['app:assembleRelease', '--no-daemon'], env, `${root}apps/mobile/android`);
