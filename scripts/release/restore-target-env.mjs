import { databaseFingerprint } from '../../apps/api/scripts/postgres-backup-envelope.mjs';
if (!process.env.RESTORE_DATABASE_URL) throw new Error('RESTORE_TARGET_REQUIRED');
process.stdout.write(
  `RESTORE_TARGET_FINGERPRINT=${databaseFingerprint(process.env.RESTORE_DATABASE_URL)}\n`,
);
