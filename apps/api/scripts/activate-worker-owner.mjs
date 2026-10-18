// Release-only compare-and-swap. Never run automatically at build or request time.
import pg from 'pg';
import { QueueClient } from '@vercel/queue';
const [deploymentId, expected] = process.argv.slice(2);
const generation = Number(expected);
if (
  !/^dpl_[A-Za-z0-9]+$/.test(deploymentId ?? '') ||
  !Number.isSafeInteger(generation) ||
  generation < 0
)
  throw new Error('Usage: node scripts/activate-worker-owner.mjs dpl_ID EXPECTED_GENERATION');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const result = await pool.query(
    `INSERT INTO "ManagedWorkerOwner" (key,"deploymentId",generation)
    SELECT 'background',$1,$2::int+1 WHERE $2::int=0 OR EXISTS (SELECT 1 FROM "ManagedWorkerOwner" WHERE key='background' AND generation=$2::int)
    ON CONFLICT (key) DO UPDATE SET "deploymentId"=$1,generation="ManagedWorkerOwner".generation+1,"activatedAt"=now()
    WHERE "ManagedWorkerOwner".generation=$2
    RETURNING "deploymentId",generation`,
    [deploymentId, generation],
  );
  const owner = result.rows[0];
  if (!owner) throw new Error('OWNER_GENERATION_CONFLICT');
  // A failed send is safe to retry by re-running activation with the reported higher generation.
  console.log(JSON.stringify({ owner, activated: true }));
  await new QueueClient({ deploymentId }).send(
    'slogan-maintenance',
    { kind: 'fallback', owner },
    {
      idempotencyKey: `g${owner.generation}-activation`,
      retentionSeconds: 604800,
    },
  );
} finally {
  await pool.end();
}
