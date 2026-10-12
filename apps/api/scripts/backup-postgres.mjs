import { basename, resolve } from 'node:path';
import { encryptedBackup } from './postgres-backup-envelope.mjs';
if (!process.env.DATABASE_URL || !process.env.BACKUP_OUTPUT_PATH)
  throw new Error('BACKUP_INPUT_REQUIRED');
const output = resolve(process.env.BACKUP_OUTPUT_PATH);
const result = await encryptedBackup(process.env.DATABASE_URL, output);
process.stdout.write(JSON.stringify({ ...result, artifact: basename(output) }) + '\n');
