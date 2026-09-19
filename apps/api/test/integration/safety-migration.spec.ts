import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';

describe('safety case and restriction additive migration', () => {
  it.each([false, true])('migrates a clean schema with historical reports=%s', async (withData) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const schema = `safety_migration_${randomUUID().replaceAll('-', '')}`;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      const names = (await readdir('prisma/migrations'))
        .filter((name) => name.startsWith('2026'))
        .sort();
      const index = names.findIndex((name) => name.endsWith('safety_case_restrictions'));
      expect(index).toBeGreaterThan(0);
      for (const name of names.slice(0, index))
        await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));

      const owner = randomUUID();
      const reporter = randomUUID();
      const room = randomUUID();
      const report = randomUUID();
      if (withData) {
        await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now()),($2,now())', [
          owner,
          reporter,
        ]);
        await client.query(
          `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,status,"startedAt","endsAt","updatedAt") VALUES ($1,$2,'Historical safety report','B1',3,'ENDED',now()-interval '1 hour',now(),now())`,
          [room, owner],
        );
        await client.query(
          `INSERT INTO "RoomMembership" (id,"roomId","userId",role,"joinOrder","rulesVersion","rulesAcceptedAt","joinedAt","participantIdentity",lifecycle) VALUES ($1,$2,$3,'HOST',1,'v1',now()-interval '1 hour',now()-interval '1 hour',$4,'ACTIVE'),($5,$2,$6,'MEMBER',2,'v1',now()-interval '50 minutes',now()-interval '50 minutes',$7,'LEFT')`,
          [randomUUID(), room, owner, randomUUID(), randomUUID(), reporter, randomUUID()],
        );
        await client.query(
          `INSERT INTO "Report" (id,"roomId","reporterUserId","targetUserId","clientRequestId",category,description,"submittedAt") VALUES ($1,$2,$3,$4,$5,'OTHER','historical report',now()-interval '30 minutes')`,
          [report, room, reporter, owner, randomUUID()],
        );
      }

      const migration = await readFile(`prisma/migrations/${names[index]}/migration.sql`, 'utf8');
      await client.query(migration);
      const counts = await client.query(
        `SELECT
          (SELECT count(*)::int FROM "Report") reports,
          (SELECT count(*)::int FROM "SafetyCase") cases,
          (SELECT count(DISTINCT "reportId")::int FROM "SafetyCase") unique_cases,
          (SELECT count(*)::int FROM "SafetyCase" c LEFT JOIN "Report" r ON r.id=c."reportId" WHERE r.id IS NULL) orphan_cases,
          (SELECT count(*)::int FROM "SafetyCaseParticipantSnapshot" p LEFT JOIN "SafetyCase" c ON c.id=p."caseId" WHERE c.id IS NULL) orphan_snapshots`,
      );
      expect(counts.rows[0]).toEqual({
        reports: withData ? 1 : 0,
        cases: withData ? 1 : 0,
        unique_cases: withData ? 1 : 0,
        orphan_cases: 0,
        orphan_snapshots: 0,
      });
      expect(
        (await client.query('SELECT count(*)::int n FROM "SafetyAssignmentState"')).rows[0].n,
      ).toBe(1);

      if (withData) {
        expect(
          await client.query(
            `SELECT c.status,c."assigneeUserId",r.id "reportId" FROM "SafetyCase" c JOIN "Report" r ON r.id=c."reportId" WHERE r.id=$1`,
            [report],
          ),
        ).toMatchObject({ rows: [{ status: 'OPEN', assigneeUserId: null, reportId: report }] });
        expect(
          (await client.query('SELECT type FROM "SafetyCaseActivity" ORDER BY type')).rows.map(
            (row) => row.type,
          ),
        ).toEqual(['CREATED', 'UNASSIGNED']);
        expect(
          (await client.query('SELECT count(*)::int n FROM "SafetyCaseParticipantSnapshot"'))
            .rows[0].n,
        ).toBe(2);

        // Re-run the data-only backfill section to prove retries do not duplicate historical facts.
        const backfill = migration.slice(migration.indexOf('INSERT INTO "SafetyCase" ('));
        await client.query(backfill);
        expect((await client.query('SELECT count(*)::int n FROM "SafetyCase"')).rows[0].n).toBe(1);
        expect(
          (await client.query('SELECT count(*)::int n FROM "SafetyCaseActivity"')).rows[0].n,
        ).toBe(2);
        expect(
          (await client.query('SELECT count(*)::int n FROM "SafetyCaseParticipantSnapshot"'))
            .rows[0].n,
        ).toBe(2);
      }
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  });
});
