import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const required = [
  'RESTORE_DATABASE_URL',
  'RESTORE_INPUT_PATH',
  'BACKUP_ENVIRONMENT_ID',
  'BACKUP_ENCRYPTION_KEY_ID',
];
if (required.some((name) => !process.env[name])) throw new Error('RESTORE_POLICY_INCOMPLETE');
if (process.env.RESTORE_ISOLATED !== 'true') throw new Error('RESTORE_TARGET_NOT_ISOLATED');
if (process.env.PROVIDERS_DISABLED !== 'true') throw new Error('RESTORE_PROVIDERS_NOT_DISABLED');
const target = new URL(process.env.RESTORE_DATABASE_URL);
const databaseIdentity = (value) => {
  const url = new URL(value);
  return `${url.protocol}//${url.hostname.toLowerCase()}:${url.port || '5432'}${url.pathname}`;
};
if (
  process.env.DATABASE_URL &&
  databaseIdentity(process.env.DATABASE_URL) === databaseIdentity(process.env.RESTORE_DATABASE_URL)
)
  throw new Error('RESTORE_ACTIVE_DATABASE_FORBIDDEN');
if (!/(restore|isolated|recovery)/i.test(target.pathname))
  throw new Error('RESTORE_TARGET_NAME_UNSAFE');
const input = resolve(process.env.RESTORE_INPUT_PATH);
if (!existsSync(input)) throw new Error('RESTORE_INPUT_NOT_FOUND');
const result = spawnSync(
  'pg_restore',
  [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '--dbname',
    process.env.RESTORE_DATABASE_URL,
    input,
  ],
  { stdio: ['ignore', 'inherit', 'inherit'], env: process.env },
);
if (result.error || result.status !== 0) throw new Error('RESTORE_FAILED');
process.stdout.write(
  JSON.stringify({ status: 'SUCCEEDED', environmentId: process.env.BACKUP_ENVIRONMENT_ID }) + '\n',
);
