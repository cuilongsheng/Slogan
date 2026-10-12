import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';

describe('room reporting additive migration', () => {
  it('preserves existing member reports and cases while accepting untargeted room records', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const schema = `room_reports_${randomUUID().replaceAll('-', '')}`;
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      const names = (await readdir('prisma/migrations'))
        .filter((name) => name.startsWith('2026'))
        .sort();
      const index = names.findIndex((name) => name.endsWith('room_report_targets'));
      expect(index).toBeGreaterThan(0);
      for (const name of names.slice(0, index))
        await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
      const [reporter, target, room, report, caseId] = Array.from({ length: 5 }, () =>
        randomUUID(),
      );
      for (const id of [reporter, target])
        await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [id]);
      await client.query(
        `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,"startedAt","endsAt","updatedAt") VALUES ($1,$2,'Existing room','B1',4,now(),now()+interval '2 hours',now())`,
        [room, reporter],
      );
      for (const [position, id] of [reporter, target].entries())
        await client.query(
          `INSERT INTO "RoomMembership" (id,"roomId","userId",role,"joinOrder","rulesVersion","rulesAcceptedAt","joinedAt","participantIdentity") VALUES ($1,$2,$3,$4,$5,'v1',now(),now(),$6)`,
          [randomUUID(), room, id, position === 0 ? 'HOST' : 'MEMBER', position + 1, randomUUID()],
        );
      const insertReport = (id: string, user: string | null) =>
        client.query(
          `INSERT INTO "Report" (id,"roomId","reporterUserId","targetUserId","clientRequestId",category,description) VALUES ($1,$2,$3,$4,$5,'OTHER','Retained report')`,
          [id, room, reporter, user, randomUUID()],
        );
      await insertReport(report!, target!);
      await client.query(
        `INSERT INTO "SafetyCase" (id,"reportId","roomId","targetUserId","updatedAt") VALUES ($1,$2,$3,$4,now())`,
        [caseId, report, room, target],
      );
      await expect(insertReport(randomUUID(), null)).rejects.toThrow();
      await client.query(await readFile(`prisma/migrations/${names[index]}/migration.sql`, 'utf8'));
      expect(
        (await client.query('SELECT "targetUserId" FROM "Report" WHERE id=$1', [report])).rows[0]
          .targetUserId,
      ).toBe(target);
      expect(
        (await client.query('SELECT "targetUserId" FROM "SafetyCase" WHERE id=$1', [caseId]))
          .rows[0].targetUserId,
      ).toBe(target);
      const roomReport = randomUUID();
      await insertReport(roomReport, null);
      await client.query(
        `INSERT INTO "SafetyCase" (id,"reportId","roomId","targetUserId","updatedAt") VALUES ($1,$2,$3,NULL,now())`,
        [randomUUID(), roomReport, room],
      );
      expect((await client.query('SELECT count(*)::int n FROM "Report"')).rows[0].n).toBe(2);
      expect((await client.query('SELECT count(*)::int n FROM "SafetyCase"')).rows[0].n).toBe(2);
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  });
});
