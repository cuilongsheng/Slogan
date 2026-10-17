import { createRequire } from 'node:module';
import { databaseFingerprint } from './postgres-backup-envelope.mjs';

const environment = process.env.OBSERVABILITY_CONTROL_ENVIRONMENT;
const operation = process.argv[2];
const url = process.env.DATABASE_URL;
if (
  !['production', 'preview', 'test'].includes(environment) ||
  !['status', 'pause', 'resume'].includes(operation)
)
  throw new Error('MONITOR_CONTROL_TARGET_REQUIRED');
if (!url || process.env.EXPECTED_DATABASE_FINGERPRINT !== databaseFingerprint(url))
  throw new Error('MONITOR_CONTROL_TARGET_NOT_APPROVED');
if (operation !== 'status' && process.env.CONFIRM_MONITOR_CONTROL !== environment)
  throw new Error('MONITOR_CONTROL_CONFIRMATION_REQUIRED');
const require = createRequire(new URL('../package.json', import.meta.url));
const { Client } = require('pg');
const db = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
try {
  await db.connect();
  if (operation !== 'status') {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `monitor:${environment}`,
    ]);
    await db.query(
      `INSERT INTO "ObservabilityMonitorState" (environment,"monitorKey",enabled,"updatedAt")
       VALUES ($1,'CONTROL',$2,now())
       ON CONFLICT (environment,"monitorKey") DO UPDATE SET enabled=EXCLUDED.enabled,"updatedAt"=now()`,
      [environment, operation === 'resume'],
    );
    await db.query('COMMIT');
  }
  const result = await db.query(
    'SELECT enabled FROM "ObservabilityMonitorState" WHERE environment=$1 AND "monitorKey"=\'CONTROL\'',
    [environment],
  );
  console.log(
    JSON.stringify({
      environment,
      enabled: result.rows[0]?.enabled ?? true,
      operation,
      reseedRequired: operation === 'resume',
    }),
  );
} catch {
  console.error('Monitor control operation failed');
  process.exitCode = 1;
} finally {
  await db.end().catch(() => undefined);
}
