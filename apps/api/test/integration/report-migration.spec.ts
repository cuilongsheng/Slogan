import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
describe('report additive migration', () => {
  it.each([false, true])(
    'preserves historical data=%s and protects reports from cascading deletes',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `report_migration_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const names = (await readdir('prisma/migrations'))
          .filter((n) => n.startsWith('2026'))
          .sort();
        const index = names.findIndex((n) => n.endsWith('safety_reporting'));
        expect(index).toBeGreaterThan(0);
        for (const name of names.slice(0, index))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
        const owner = randomUUID(),
          reporter = randomUUID(),
          room = randomUUID(),
          firstMember = randomUUID(),
          secondMember = randomUUID(),
          event = randomUUID();
        if (withData) {
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now()),($2,now())', [
            owner,
            reporter,
          ]);
          await client.query(
            `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,"startedAt","endsAt","updatedAt",status) VALUES ($1,$2,'Before reports','B1',3,now(),now()+interval '2 hours',now(),'ENDED')`,
            [room, owner],
          );
          for (const [id, user, role, order, lifecycle] of [
            [firstMember, owner, 'HOST', 1, 'ACTIVE'],
            [secondMember, reporter, 'MEMBER', 2, 'REMOVED'],
          ])
            await client.query(
              `INSERT INTO "RoomMembership" (id,"roomId","userId",role,"joinOrder","rulesVersion","rulesAcceptedAt","joinedAt","participantIdentity",lifecycle) VALUES ($1,$2,$3,$4,$5,'test',now(),now(),$6,$7)`,
              [id, room, user, role, order, randomUUID(), lifecycle],
            );
          await client.query(
            `INSERT INTO "RoomEvent" (id,"roomId",type,source,result,"occurredAt") VALUES ($1,$2,'member_remove','http','COMMITTED',now())`,
            [event, room],
          );
        }
        await client.query(
          await readFile(`prisma/migrations/${names[index]}/migration.sql`, 'utf8'),
        );
        expect((await client.query('SELECT count(*)::int AS n FROM "Report"')).rows[0].n).toBe(0);
        if (withData) {
          expect(
            (await client.query('SELECT "reportId" FROM "RoomEvent" WHERE id=$1', [event])).rows[0]
              .reportId,
          ).toBeNull();
          expect(
            (
              await client.query('SELECT lifecycle,"joinOrder" FROM "RoomMembership" WHERE id=$1', [
                secondMember,
              ])
            ).rows[0],
          ).toEqual({ lifecycle: 'REMOVED', joinOrder: 2 });
          // Old room projection remains compatible with the additive schema.
          expect(
            (await client.query('SELECT id,status FROM "Room" WHERE id=$1', [room])).rows[0],
          ).toEqual({ id: room, status: 'ENDED' });
          await client.query('UPDATE "Room" SET topic=$1 WHERE id=$2', [
            'Old version update',
            room,
          ]);
          const report = randomUUID();
          await client.query(
            `INSERT INTO "Report" (id,"roomId","reporterUserId","targetUserId","clientRequestId",category,description) VALUES ($1,$2,$3,$4,$5,'OTHER','retained statement')`,
            [report, room, reporter, owner, randomUUID()],
          );
          await expect(client.query('DELETE FROM "Room" WHERE id=$1', [room])).rejects.toThrow();
          await expect(
            client.query('DELETE FROM "RoomMembership" WHERE id=$1', [secondMember]),
          ).rejects.toThrow();
          await expect(
            client.query(`UPDATE "Report" SET category='INVALID' WHERE id=$1`, [report]),
          ).rejects.toThrow();
          await expect(
            client.query(`UPDATE "Report" SET description=$1 WHERE id=$2`, [
              '😀'.repeat(2001),
              report,
            ]),
          ).rejects.toThrow();
          expect(
            (await client.query('SELECT description FROM "Report" WHERE id=$1', [report])).rows[0]
              .description,
          ).toBe('retained statement');
        }
        const idx = await client.query('SELECT indexname FROM pg_indexes WHERE schemaname=$1', [
          schema,
        ]);
        expect(idx.rows.map((r) => r.indexname)).toEqual(
          expect.arrayContaining([
            'Report_reporterUserId_clientRequestId_key',
            'RoomEvent_reportId_key',
            'Report_roomId_submittedAt_id_idx',
          ]),
        );
      } finally {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
