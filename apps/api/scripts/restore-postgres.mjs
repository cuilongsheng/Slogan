import { isolatedRestore } from './postgres-backup-envelope.mjs';
if (!process.env.RESTORE_DATABASE_URL || !process.env.RESTORE_INPUT_PATH)
  throw new Error('RESTORE_INPUT_REQUIRED');
const result = await isolatedRestore(
  process.env.RESTORE_DATABASE_URL,
  process.env.RESTORE_INPUT_PATH,
);
process.stdout.write(JSON.stringify(result) + '\n');
