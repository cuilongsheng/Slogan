import { spawn } from 'node:child_process';
import { assertMain } from './deployment-gate.mjs';
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
const child = spawn(
  'pnpm',
  [
    'dlx',
    'vercel@63.1.2',
    'deploy',
    '--prod',
    '--yes',
    '--token',
    process.env.VERCEL_TOKEN,
    '--meta',
    `githubCommitSha=${sha}`,
    '--build-env',
    `SLOGAN_RELEASE_COMMIT=${sha}`,
    '--env',
    `SLOGAN_RELEASE_COMMIT=${sha}`,
  ],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 1_800_000 },
);
// Keep provider output out of CI logs; failures are investigated in the provider deployment log.
child.stdout.resume();
child.stderr.resume();
await new Promise((accept, reject) => {
  child.once('error', () => reject(new Error('API_DEPLOY_FAILED')));
  child.once('close', (code) => (code === 0 ? accept() : reject(new Error('API_DEPLOY_FAILED'))));
});
process.stdout.write(JSON.stringify({ status: 'SUCCEEDED', commit: sha }) + '\n');
