import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

describe('host controls additive upgrade and rollback isolation', () => {
  it.each([false, true])(
    'preserves LiveKit runtime data=%s without destructive downgrade',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `host_migration_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const names = (await readdir('prisma/migrations'))
          .filter((n) => n.startsWith('2026'))
          .sort();
        const target = names.findIndex((n) => n.endsWith('host_controls'));
        expect(target).toBeGreaterThan(0);
        for (const name of names.slice(0, target))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
        const user = randomUUID(),
          room = randomUUID(),
          member = randomUUID(),
          identity = randomUUID(),
          command = randomUUID(),
          event = randomUUID();
        if (withData) {
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [user]);
          await client.query(
            `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,"startedAt","endsAt","updatedAt",status,"stateVersion","providerRoomSid") VALUES ($1,$2,'Migration','B1',4,now(),now()+interval '2 hours',now(),'ENDING',7,'RM_preserved')`,
            [room, user],
          );
          await client.query(
            `INSERT INTO "RoomMembership" (id,"roomId","userId",role,"joinOrder","rulesVersion","rulesAcceptedAt","joinedAt","participantIdentity","credentialVersion",presence) VALUES ($1,$2,$3,'HOST',9,'test',now(),now(),$4,3,'CONNECTED')`,
            [member, room, user, identity],
          );
          await client.query(
            `INSERT INTO "RealtimeIdentity" (identity,"roomId","membershipId","credentialVersion","issueUntil") VALUES ($1,$2,$3,3,now())`,
            [identity, room, member],
          );
          await client.query(
            `INSERT INTO "RealtimeCommand" (id,key,"roomId",type,identity,"stateVersion") VALUES ($1,'preserved',$2,'REVOKE_IDENTITY',$3,7)`,
            [command, room, identity],
          );
          await client.query(
            `INSERT INTO "RoomEvent" (id,"roomId",type,source,result,"occurredAt") VALUES ($1,$2,'room_ending','server','PENDING',now())`,
            [event, room],
          );
        }
        await client.query(
          await readFile(`prisma/migrations/${names[target]}/migration.sql`, 'utf8'),
        );
        const rows = await client.query(
          'SELECT id,"joinOrder","participantIdentity","credentialVersion",presence,lifecycle FROM "RoomMembership"',
        );
        expect(rows.rowCount).toBe(withData ? 1 : 0);
        if (withData) {
          expect(rows.rows[0]).toEqual({
            id: member,
            joinOrder: 9,
            participantIdentity: identity,
            credentialVersion: 3,
            presence: 'CONNECTED',
            lifecycle: 'ACTIVE',
          });
          expect(
            (
              await client.query(
                'SELECT status,"stateVersion","providerRoomSid","hostReconnectVersion","hostReconnectDeadline" FROM "Room"',
              )
            ).rows[0],
          ).toEqual({
            status: 'ENDING',
            stateVersion: 7,
            providerRoomSid: 'RM_preserved',
            hostReconnectVersion: 0,
            hostReconnectDeadline: null,
          });
          expect((await client.query('SELECT id,status FROM "RealtimeCommand"')).rows[0]).toEqual({
            id: command,
            status: 'PENDING',
          });
          expect(
            (await client.query('SELECT identity FROM "RealtimeIdentity"')).rows[0].identity,
          ).toBe(identity);
          expect((await client.query('SELECT id FROM "RoomEvent"')).rows[0].id).toBe(event);
          // Simulate a failed application mutation; rollback must retain restrictions/history.
          await client.query(`UPDATE "RoomMembership" SET lifecycle='REMOVED' WHERE id=$1`, [
            member,
          ]);
          await client.query('BEGIN');
          await client.query(`UPDATE "RoomMembership" SET lifecycle='ACTIVE' WHERE id=$1`, [
            member,
          ]);
          await client.query('ROLLBACK');
          expect(
            (await client.query('SELECT lifecycle FROM "RoomMembership"')).rows[0].lifecycle,
          ).toBe('REMOVED');
          expect(
            (await client.query('SELECT count(*)::int AS n FROM "RealtimeCommand"')).rows[0].n,
          ).toBe(1);
          await expect(
            client.query(`UPDATE "RoomMembership" SET lifecycle='UNKNOWN'`),
          ).rejects.toThrow();
          await expect(
            client.query(`UPDATE "RoomMembership" SET "roomId"=$1`, [randomUUID()]),
          ).rejects.toThrow();
        }
        const indexes = await client.query('SELECT indexname FROM pg_indexes WHERE schemaname=$1', [
          schema,
        ]);
        expect(indexes.rows.map((r) => r.indexname)).toContain(
          'RoomMembership_roomId_lifecycle_idx',
        );
        const tables = await client.query(
          'SELECT table_name FROM information_schema.tables WHERE table_schema=$1',
          [schema],
        );
        expect(
          tables.rows.filter((r) =>
            ['RoomEvent', 'RealtimeCommand', 'RealtimeIdentity'].includes(r.table_name),
          ),
        ).toHaveLength(3);
      } finally {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
