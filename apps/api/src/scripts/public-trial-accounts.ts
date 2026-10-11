import { readFile, lstat } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { PublicTrialService } from '../modules/auth/index.js';
function argument(name: string) {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}
async function main() {
  const allowed = new Set(['--environment', '--action', '--input']);
  if (
    process.argv.slice(2).some((value, i) => i % 2 === 0 && !allowed.has(value)) ||
    process.argv.length % 2 !== 0
  )
    throw new Error('PUBLIC_TRIAL_ARGUMENTS_INVALID');
  const environment = argument('--environment');
  const action = argument('--action');
  const target = process.env.PREVIEW_DATABASE_URL;
  if (
    !target ||
    !environment ||
    environment !== process.env.PREVIEW_ENVIRONMENT_ID ||
    !['dry-run', 'provision', 'status', 'disable'].includes(action ?? '')
  )
    throw new Error('PUBLIC_TRIAL_EXPLICIT_TARGET_REQUIRED');
  const url = new URL(target);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname === '/')
    throw new Error('PUBLIC_TRIAL_TARGET_INVALID');
  process.env.DATABASE_URL = target;
  const { AppModule } = await import('../app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const service = app.get(PublicTrialService);
    if (action === 'status')
      process.stdout.write(
        JSON.stringify({ action, accounts: await service.inspect(environment) }) + '\n',
      );
    else if (action === 'disable')
      process.stdout.write(
        JSON.stringify({ action, disabled: await service.disable(environment) }) + '\n',
      );
    else {
      const path = argument('--input');
      if (!path) throw new Error('PUBLIC_TRIAL_INPUT_REQUIRED');
      const stat = await lstat(path);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        (stat.mode & 0o777) !== 0o600 ||
        (process.getuid && stat.uid !== process.getuid())
      )
        throw new Error('PUBLIC_TRIAL_INPUT_PERMISSIONS');
      const input: unknown = JSON.parse(await readFile(path, 'utf8'));
      if (
        !input ||
        typeof input !== 'object' ||
        !('password' in input) ||
        typeof input.password !== 'string'
      )
        throw new Error('PUBLIC_TRIAL_INPUT_INVALID');
      process.stdout.write(
        JSON.stringify({
          action,
          ...(await service.provision(environment, input.password, action === 'dry-run')),
        }) + '\n',
      );
    }
  } finally {
    await app.close();
  }
}
void main().catch(() => {
  process.stderr.write('PUBLIC_TRIAL_COMMAND_FAILED\n');
  process.exitCode = 1;
});
