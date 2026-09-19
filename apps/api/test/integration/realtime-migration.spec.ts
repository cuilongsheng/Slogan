import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

describe('realtime additive migration', () => {
  it.each([false, true])(
    'upgrades an isolated schema with existing membership=%s',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `realtime_migration_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const names = (await readdir('prisma/migrations'))
          .filter((n) => n.startsWith('2026'))
          .sort();
        for (const name of names.slice(0, 2))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
        const user = randomUUID(),
          room = randomUUID(),
          member = randomUUID();
        if (withData) {
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [user]);
          await client.query(
            `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,"startedAt","endsAt","updatedAt") VALUES ($1,$2,'Migration','B1',4,now(),now()+interval '2 hours',now())`,
            [room, user],
          );
          await client.query(
            `INSERT INTO "RoomMembership" (id,"roomId","userId",role,"joinOrder","rulesVersion","rulesAcceptedAt","joinedAt") VALUES ($1,$2,$3,'HOST',1,'test',now(),now())`,
            [member, room, user],
          );
        }
        for (const name of names.slice(2))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
        const result = await client.query(
          'SELECT id,"participantIdentity",presence,"joinOrder","credentialVersion" FROM "RoomMembership"',
        );
        expect(result.rowCount).toBe(withData ? 1 : 0);
        if (withData) {
          expect(result.rows[0]).toMatchObject({
            id: member,
            presence: 'DISCONNECTED',
            joinOrder: 1,
            credentialVersion: 0,
          });
          expect(result.rows[0].participantIdentity).toMatch(/^[0-9a-f-]{36}$/);
          const row = await client.query('SELECT "stateVersion",status FROM "Room" WHERE id=$1', [
            room,
          ]);
          expect(row.rows[0]).toEqual({ stateVersion: 0, status: 'OPEN' });
          // An old control-plane projection can still read the preserved columns.
          expect(
            (
              await client.query('SELECT "roomId","userId" FROM "RoomMembership" WHERE id=$1', [
                member,
              ])
            ).rowCount,
          ).toBe(1);
        }
        const tables = await client.query(
          'SELECT table_name FROM information_schema.tables WHERE table_schema=$1',
          [schema],
        );
        expect(tables.rows.map((r) => r.table_name)).toEqual(
          expect.arrayContaining(['RoomEvent', 'RealtimeCommand', 'RealtimeIdentity']),
        );
      } finally {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
