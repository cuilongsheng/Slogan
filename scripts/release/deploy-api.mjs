import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { assertMain } from './deployment-gate.mjs';
import { commandDiagnostic } from './command-diagnostic.mjs';
const sha = process.env.SLOGAN_RELEASE_COMMIT;
if (
  process.env.GITHUB_REF !== 'refs/heads/main' ||
  process.env.GITHUB_EVENT_NAME === 'pull_request' ||
  !/^[a-f0-9]{40}$/.test(sha || '')
)
  throw new Error('DEPLOY_MAIN_REQUIRED');
for (const name of ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'])
  if (!process.env[name]) throw new Error('DEPLOY_CONFIGURATION_REQUIRED');
await assertMain(sha);
async function run(command, args, env = process.env) {
  const child = spawn(command, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 1_800_000,
  });
  const diagnostic = commandDiagnostic(child);
  await new Promise((accept, reject) => {
    child.once('error', () => reject(new Error('API_DEPLOY_FAILED')));
    child.once('close', (code) =>
      code === 0 ? accept() : reject(new Error(`API_DEPLOY_FAILED: ${diagnostic()}`)),
    );
  });
}
const deploymentEnv = { ...process.env };
delete deploymentEnv.SENTRY_AUTH_TOKEN;
delete deploymentEnv.SENTRY_ORG;
delete deploymentEnv.SENTRY_PROJECT;
if (process.env.SENTRY_UPLOAD_SOURCEMAPS === 'true') {
  await mkdir('.vercel', { recursive: true });
  await writeFile(
    '.vercel/project.json',
    JSON.stringify({
      projectId: process.env.VERCEL_PROJECT_ID,
      orgId: process.env.VERCEL_ORG_ID,
    }),
  );
  await run(
    'pnpm',
    [
      'dlx',
      '--allow-build=esbuild',
      'vercel@63.1.2',
      'pull',
      '--yes',
      '--environment',
      'production',
    ],
    deploymentEnv,
  );
  await run(process.execPath, ['scripts/build-observability-vercel.mjs', 'production']);
  await assertMain(sha);
  await run(
    process.execPath,
    ['scripts/deploy-observability-vercel.mjs', 'production'],
    deploymentEnv,
  );
} else {
  await run(
    'pnpm',
    [
      'dlx',
      '--allow-build=esbuild',
      'vercel@63.1.2',
      'deploy',
      '--prod',
      '--yes',
      '--meta',
      `githubCommitSha=${sha}`,
      '--build-env',
      `SLOGAN_RELEASE_COMMIT=${sha}`,
      '--env',
      `SLOGAN_RELEASE_COMMIT=${sha}`,
    ],
    deploymentEnv,
  );
}
process.stdout.write(JSON.stringify({ status: 'SUCCEEDED', commit: sha }) + '\n');
