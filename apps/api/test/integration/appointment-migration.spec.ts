import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
describe('appointment additive migration', () => {
  it.each([false, true])(
    'upgrades an isolated schema with historical data=%s',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `appointment_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const names = (await readdir('prisma/migrations'))
          .filter((n) => n.startsWith('2026'))
          .sort();
        const index = names.findIndex((n) => n.endsWith('appointment_rooms'));
        for (const name of names.slice(0, index))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
        const user = randomUUID();
        const rooms = [randomUUID(), randomUUID(), randomUUID()];
        if (withData) {
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [user]);
          for (const [i, status] of ['OPEN', 'ENDING', 'ENDED'].entries()) {
            await client.query(
              'INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,status,"startedAt","endsAt","updatedAt") VALUES ($1,$2,\'Historical\',\'B1\',2,$3,now(),now()+interval \'2 hours\',now())',
              [rooms[i], user, status],
            );
            await client.query(
              'INSERT INTO "RoomMembership" (id,"roomId","userId",role,"joinOrder","rulesVersion","rulesAcceptedAt","joinedAt",lifecycle,"participantIdentity") VALUES ($1,$2,$3,\'HOST\',1,\'v1\',now(),now(),$4,$5)',
              [
                randomUUID(),
                rooms[i],
                user,
                i === 0 ? 'ACTIVE' : i === 1 ? 'LEFT' : 'REMOVED',
                randomUUID(),
              ],
            );
          }
        }
        await client.query(
          await readFile(`prisma/migrations/${names[index]}/migration.sql`, 'utf8'),
        );
        expect(
          (await client.query('SELECT count(*)::int AS n FROM "RoomReservation"')).rows[0].n,
        ).toBe(0);
        if (withData) {
          expect((await client.query('SELECT DISTINCT kind FROM "Room"')).rows).toEqual([
            { kind: 'INSTANT' },
          ]);
          expect(
            (await client.query('SELECT count(*)::int AS n FROM "RoomMembership"')).rows[0].n,
          ).toBe(3);
          await client.query(
            'INSERT INTO "RoomReservation" (id,"roomId","userId") VALUES ($1,$2,$3)',
            [randomUUID(), rooms[0], user],
          );
          await expect(
            client.query('DELETE FROM "Room" WHERE id=$1', [rooms[0]]),
          ).rejects.toThrow();
          await expect(client.query('UPDATE "RoomReservation" SET version=0')).rejects.toThrow();
        }
      } finally {
        await client.query('SET search_path TO public');
        await client.query(`DROP SCHEMA "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
