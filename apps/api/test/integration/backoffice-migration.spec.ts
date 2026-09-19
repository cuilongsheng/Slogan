import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

describe('backoffice additive migration', () => {
  it.each([false, true])(
    'preserves the current schema and historical data=%s',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `backoffice_migration_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const names = (await readdir('prisma/migrations'))
          .filter((name) => name.startsWith('2026'))
          .sort();
        const index = names.findIndex((name) => name.endsWith('backoffice_rbac_audit'));
        expect(index).toBeGreaterThan(0);
        for (const name of names.slice(0, index))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
        const owner = randomUUID(),
          member = randomUUID(),
          session = randomUUID(),
          room = randomUUID(),
          hostMembership = randomUUID(),
          memberMembership = randomUUID(),
          report = randomUUID(),
          event = randomUUID(),
          reservation = randomUUID(),
          note = randomUUID();
        if (withData) {
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now()),($2,now())', [
            owner,
            member,
          ]);
          await client.query(
            'INSERT INTO "AuthSession" (id,"userId","expiresAt","updatedAt") VALUES ($1,$2,now()+interval \'1 day\',now())',
            [session, owner],
          );
          await client.query(
            `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,status,"startedAt","endsAt","updatedAt") VALUES ($1,$2,'Retained','B1',3,'ENDED',now()-interval '1 hour',now(),now())`,
            [room, owner],
          );
          await client.query(
            `INSERT INTO "RoomMembership" (id,"roomId","userId",role,"joinOrder","rulesVersion","rulesAcceptedAt","joinedAt","participantIdentity",lifecycle) VALUES ($1,$2,$3,'HOST',1,'v1',now(),now(),$4,'ACTIVE'),($5,$2,$6,'MEMBER',2,'v1',now(),now(),$7,'LEFT')`,
            [hostMembership, room, owner, randomUUID(), memberMembership, member, randomUUID()],
          );
          await client.query(
            `INSERT INTO "Report" (id,"roomId","reporterUserId","targetUserId","clientRequestId",category,description) VALUES ($1,$2,$3,$4,$5,'OTHER','retained')`,
            [report, room, member, owner, randomUUID()],
          );
          await client.query(
            `INSERT INTO "RoomEvent" (id,"roomId",type,source,"actorId","targetId",reason,result,"occurredAt","reportId") VALUES ($1,$2,'report_submitted','http',$3,$4,'OTHER','SUBMITTED',now(),$5)`,
            [event, room, member, owner, report],
          );
          await client.query(
            `INSERT INTO "RoomReservation" (id,"roomId","userId",status) VALUES ($1,$2,$3,'BOOKED')`,
            [reservation, room, member],
          );
          await client.query(
            `INSERT INTO "RoomNote" (id,"roomId","userId",content,"updatedAt") VALUES ($1,$2,$3,'retained note',now())`,
            [note, room, member],
          );
        }
        await client.query(
          await readFile(`prisma/migrations/${names[index]}/migration.sql`, 'utf8'),
        );
        expect(
          (await client.query('SELECT count(*)::int AS n FROM "BackofficeRoleAssignment"')).rows[0]
            .n,
        ).toBe(0);
        expect(
          (await client.query('SELECT count(*)::int AS n FROM "BackofficeAuditEvent"')).rows[0].n,
        ).toBe(0);
        if (withData) {
          for (const table of [
            'User',
            'AuthSession',
            'Room',
            'Report',
            'RoomEvent',
            'RoomReservation',
            'RoomNote',
          ])
            expect(
              (await client.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n,
            ).toBeGreaterThan(0);
          await client.query(
            `INSERT INTO "BackofficeRoleAssignment" (id,"userId",role) VALUES ($1,$2,'PLATFORM_ADMIN')`,
            [randomUUID(), owner],
          );
          await expect(
            client.query(
              `INSERT INTO "BackofficeRoleAssignment" (id,"userId",role) VALUES ($1,$2,'PLATFORM_ADMIN')`,
              [randomUUID(), owner],
            ),
          ).rejects.toThrow();
          await expect(client.query('DELETE FROM "User" WHERE id=$1', [owner])).rejects.toThrow();
          expect(
            (await client.query('SELECT topic FROM "Room" WHERE id=$1', [room])).rows[0].topic,
          ).toBe('Retained');
        }
      } finally {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
