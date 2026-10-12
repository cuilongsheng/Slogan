import { databaseFingerprint } from '../../apps/api/scripts/postgres-backup-envelope.mjs';
if (
  process.env.GITHUB_REF !== 'refs/heads/main' ||
  process.env.GITHUB_EVENT_NAME === 'pull_request' ||
  process.env.BACKUP_ENVIRONMENT_ID !== 'production'
)
  throw new Error('PRODUCTION_MAIN_REQUIRED');
if (
  !process.env.DATABASE_URL ||
  process.env.PRODUCTION_DATABASE_FINGERPRINT !== databaseFingerprint(process.env.DATABASE_URL)
)
  throw new Error('PRODUCTION_TARGET_NOT_APPROVED');
