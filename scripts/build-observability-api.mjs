import { fileURLToPath } from 'node:url';
import {
  buildMetadata,
  currentRevision,
  runTool,
  uploadSourceMaps,
  requireCleanRelease,
} from './observability-build.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = buildMetadata('api', process.env, currentRevision());
if (metadata.enabled) requireCleanRelease();
runTool('pnpm', ['--filter', '@slogan/shared', 'build'], metadata.env);
runTool('pnpm', ['--filter', '@slogan/api', 'build'], metadata.env);
// Independent Vercel artifacts require a separate post-vercel-build invocation.
const output = process.argv[2] ?? `${root}apps/api/dist`;
await uploadSourceMaps('api', output, metadata);
