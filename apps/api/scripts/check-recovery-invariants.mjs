import pg from 'pg';
const { Pool } = pg;
if (!process.env.RESTORE_DATABASE_URL) throw new Error('RESTORE_DATABASE_URL_REQUIRED');
const pool = new Pool({ connectionString: process.env.RESTORE_DATABASE_URL, max: 1 });
const checks = [
  [
    'migrations',
    `SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL`,
  ],
  [
    'identity_ownership',
    `SELECT COUNT(*)::int AS count FROM (
      SELECT oi.id FROM "OAuthIdentity" oi LEFT JOIN "User" u ON u.id=oi."userId" WHERE u.id IS NULL
      UNION ALL SELECT pi.id FROM "PhoneIdentity" pi LEFT JOIN "User" u ON u.id=pi."userId" WHERE u.id IS NULL
      UNION ALL SELECT s.id FROM "AuthSession" s LEFT JOIN "User" u ON u.id=s."userId" WHERE u.id IS NULL
    ) invalid`,
  ],
  [
    'room_membership',
    `SELECT COUNT(*)::int AS count FROM (
      SELECT m.id FROM "RoomMembership" m LEFT JOIN "Room" r ON r.id=m."roomId" LEFT JOIN "User" u ON u.id=m."userId" WHERE r.id IS NULL OR u.id IS NULL
      UNION ALL SELECT r.id FROM "Room" r LEFT JOIN "User" u ON u.id=r."hostUserId" WHERE u.id IS NULL
    ) invalid`,
  ],
  [
    'reservations',
    `SELECT COUNT(*)::int AS count FROM "RoomReservation" rr LEFT JOIN "Room" r ON r.id=rr."roomId" LEFT JOIN "User" u ON u.id=rr."userId" WHERE r.id IS NULL OR u.id IS NULL`,
  ],
  [
    'safety',
    `SELECT COUNT(*)::int AS count FROM (
      SELECT c.id FROM "SafetyCase" c LEFT JOIN "Report" r ON r.id=c."reportId" LEFT JOIN "Room" room ON room.id=c."roomId" LEFT JOIN "User" u ON u.id=c."targetUserId" WHERE r.id IS NULL OR room.id IS NULL OR u.id IS NULL
      UNION ALL SELECT sr.id FROM "SafetyRestriction" sr LEFT JOIN "SafetyCase" c ON c.id=sr."caseId" LEFT JOIN "User" u ON u.id=sr."userId" WHERE c.id IS NULL OR u.id IS NULL
      UNION ALL SELECT a.id FROM "SafetyAppeal" a LEFT JOIN "SafetyRestriction" sr ON sr.id=a."restrictionId" LEFT JOIN "User" u ON u.id=a."userId" WHERE sr.id IS NULL OR u.id IS NULL
    ) invalid`,
  ],
  [
    'roles',
    `SELECT COUNT(*)::int AS count FROM (
      SELECT a.id FROM "BackofficeRoleAssignment" a LEFT JOIN "User" u ON u.id=a."userId" WHERE u.id IS NULL
      UNION ALL SELECT e.id FROM "BackofficeAuditEvent" e LEFT JOIN "User" u ON u.id=e."actorUserId" WHERE e."actorUserId" IS NOT NULL AND u.id IS NULL
    ) invalid`,
  ],
  [
    'private_content',
    `SELECT COUNT(*)::int AS count FROM (
      SELECT n.id FROM "RoomNote" n LEFT JOIN "User" u ON u.id=n."userId" LEFT JOIN "Room" r ON r.id=n."roomId" WHERE u.id IS NULL OR r.id IS NULL
      UNION ALL SELECT v.id FROM "VocabularyItem" v LEFT JOIN "User" u ON u.id=v."userId" WHERE u.id IS NULL
    ) invalid`,
  ],
  [
    'commands',
    `SELECT COUNT(*)::int AS count FROM (
      SELECT c.id FROM "RealtimeCommand" c LEFT JOIN "Room" r ON r.id=c."roomId" WHERE r.id IS NULL
      UNION ALL SELECT c.id FROM "AccountLifecycleCommand" c LEFT JOIN "User" u ON u.id=c."userId" WHERE u.id IS NULL
      UNION ALL SELECT c.id FROM "SafetyCommand" c LEFT JOIN "User" u ON u.id=c."actorUserId" WHERE u.id IS NULL
      UNION ALL SELECT c.id FROM "SocialCommand" c LEFT JOIN "User" u ON u.id=c."actorUserId" WHERE u.id IS NULL
    ) invalid`,
  ],
  [
    'governance',
    `SELECT COUNT(*)::int AS count FROM (
      SELECT r.id FROM "RetentionRun" r LEFT JOIN "RetentionPolicyVersion" p ON p.id=r."policyId" LEFT JOIN "RetentionDryRun" d ON d.id=r."dryRunId" WHERE p.id IS NULL OR d.id IS NULL
      UNION ALL SELECT d.id FROM "RetentionDryRun" d LEFT JOIN "RetentionPolicyVersion" p ON p.id=d."policyId" WHERE p.id IS NULL
      UNION ALL SELECT b.id FROM "RetentionRunBatch" b LEFT JOIN "RetentionRun" r ON r.id=b."runId" WHERE r.id IS NULL
      UNION ALL SELECT p.id FROM "RetentionPolicyVersion" p LEFT JOIN "User" u ON u.id=p."createdByUserId" WHERE u.id IS NULL
    ) invalid`,
  ],
];
const result = {};
let failed = false;
for (const [name, sql] of checks) {
  const rows = await pool.query(sql);
  const count = Number(rows.rows[0]?.count ?? 0);
  const migrationCheck = name === 'migrations';
  const ok = migrationCheck ? count > 0 : count === 0;
  result[name] = { ok, count };
  if (!ok) failed = true;
}
await pool.end();
process.stdout.write(
  JSON.stringify({ status: failed ? 'FAILED' : 'SUCCEEDED', checks: result }) + '\n',
);
if (failed) process.exitCode = 1;
