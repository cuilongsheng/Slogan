import { readFileSync } from 'node:fs';
import pg from 'pg';

describe('recovery safety integrity query', () => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });
  // Execute the release script's actual SQL, against session-local tables only.
  const source = readFileSync('scripts/check-recovery-invariants.mjs', 'utf8');
  const query = source.match(/'safety',\s*`([^`]+)`/)?.[1];

  beforeAll(async () => {
    if (!query) throw new Error('Recovery safety query missing');
    await client.connect();
    await client.query(`
      CREATE TEMP TABLE "User" (id text);
      CREATE TEMP TABLE "Room" (id text);
      CREATE TEMP TABLE "Report" (id text);
      CREATE TEMP TABLE "SafetyCase" (id text, "reportId" text, "roomId" text, "targetUserId" text);
      CREATE TEMP TABLE "SafetyRestriction" (id text, "caseId" text, "userId" text);
      CREATE TEMP TABLE "SafetyAppeal" (id text, "restrictionId" text, "userId" text);
      INSERT INTO "User" VALUES ('user');
      INSERT INTO "Room" VALUES ('room');
      INSERT INTO "Report" VALUES ('report');
    `);
  });
  beforeEach(async () => {
    await client.query('TRUNCATE "SafetyCase", "SafetyRestriction", "SafetyAppeal"');
  });
  afterAll(() => client.end());

  it.each([
    ['room report with no individual target', 'report', 'room', null, 0],
    ['user report with no room', 'report', null, 'user', 0],
    ['missing report', 'missing', 'room', null, 1],
    ['missing non-null room', 'report', 'missing', null, 1],
    ['missing non-null user', 'report', 'room', 'missing', 1],
  ])('%s', async (_name, report, room, user, expected) => {
    await client.query('INSERT INTO "SafetyCase" VALUES ($1, $2, $3, $4)', [
      'case',
      report,
      room,
      user,
    ]);
    const result = await client.query(query!);
    expect(result.rows[0].count).toBe(expected);
  });

  it('still rejects orphaned restrictions and appeals', async () => {
    await client.query(`
      INSERT INTO "SafetyRestriction" VALUES ('restriction', 'missing', 'user');
      INSERT INTO "SafetyAppeal" VALUES ('appeal', 'missing', 'user');
    `);
    const result = await client.query(query!);
    expect(result.rows[0].count).toBe(2);
  });
});
