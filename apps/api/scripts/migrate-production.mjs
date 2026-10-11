import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { databaseFingerprint, decryptBackup, digestFile } from './postgres-backup-envelope.mjs';
const sha = process.env.SLOGAN_RELEASE_COMMIT;
if (
  process.env.GITHUB_REF !== 'refs/heads/main' ||
  process.env.GITHUB_EVENT_NAME === 'pull_request' ||
  !/^[a-f0-9]{40}$/.test(sha || '')
)
  throw new Error('MIGRATION_MAIN_REQUIRED');
if (
  !process.env.DATABASE_URL ||
  process.env.PRODUCTION_DATABASE_FINGERPRINT !== databaseFingerprint(process.env.DATABASE_URL)
)
  throw new Error('MIGRATION_TARGET_NOT_APPROVED');
if (!process.env.BACKUP_OUTPUT_PATH || !process.env.BACKUP_RECEIPT_PATH)
  throw new Error('MIGRATION_BACKUP_REQUIRED');
const receipt = JSON.parse(await readFile(process.env.BACKUP_RECEIPT_PATH, 'utf8'));
if (
  receipt.status !== 'SUCCEEDED' ||
  receipt.encrypted !== true ||
  receipt.digest !== (await digestFile(process.env.BACKUP_OUTPUT_PATH))
)
  throw new Error('MIGRATION_BACKUP_INVALID');
const archive = await decryptBackup(process.env.BACKUP_OUTPUT_PATH);
try {
  const createdAt = Date.parse(archive.header.createdAt);
  if (!Number.isFinite(createdAt) || createdAt > Date.now() + 60_000)
    throw new Error('MIGRATION_BACKUP_DATE_INVALID');
  if (
    archive.header.databaseFingerprint !== process.env.PRODUCTION_DATABASE_FINGERPRINT ||
    archive.header.environmentId !== 'production' ||
    Date.now() - createdAt > 3_600_000
  )
    throw new Error('MIGRATION_BACKUP_STALE_OR_WRONG_TARGET');
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/git/ref/heads/main`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok || (await response.json()).object.sha !== sha)
    throw new Error('MIGRATION_MAIN_CHANGED');
  const child = spawn('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600_000,
  });
  child.stdout.resume();
  child.stderr.resume();
  await new Promise((accept, reject) => {
    child.once('error', () => reject(new Error('MIGRATION_FAILED')));
    child.once('close', (code) => (code === 0 ? accept() : reject(new Error('MIGRATION_FAILED'))));
  });
  process.stdout.write(
    JSON.stringify({ status: 'SUCCEEDED', commit: sha, backupDigest: receipt.digest }) + '\n',
  );
} finally {
  await archive.cleanup();
}
