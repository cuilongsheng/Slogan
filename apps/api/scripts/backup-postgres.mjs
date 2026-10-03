import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const required = [
  'DATABASE_URL',
  'BACKUP_ENVIRONMENT_ID',
  'BACKUP_ENCRYPTION_KEY_ID',
  'BACKUP_RETENTION_COUNT',
  'BACKUP_RPO_SECONDS',
  'BACKUP_RTO_SECONDS',
];
if (required.some((name) => !process.env[name])) throw new Error('BACKUP_POLICY_INCOMPLETE');
if (!process.env.BACKUP_OUTPUT_PATH) throw new Error('BACKUP_OUTPUT_PATH_REQUIRED');
const output = resolve(process.env.BACKUP_OUTPUT_PATH);
await mkdir(dirname(output), { recursive: true });
const result = spawnSync(
  'pg_dump',
  ['--format=custom', '--no-owner', '--no-acl', '--file', output, process.env.DATABASE_URL],
  { stdio: ['ignore', 'inherit', 'inherit'], env: process.env },
);
if (result.error || result.status !== 0 || !existsSync(output)) throw new Error('BACKUP_FAILED');
const hash = createHash('sha256');
for await (const chunk of createReadStream(output)) hash.update(chunk);
process.stdout.write(
  JSON.stringify({
    status: 'SUCCEEDED',
    environmentId: process.env.BACKUP_ENVIRONMENT_ID,
    encryptionKeyId: process.env.BACKUP_ENCRYPTION_KEY_ID,
    artifact: basename(output),
    digest: hash.digest('hex'),
  }) + '\n',
);
