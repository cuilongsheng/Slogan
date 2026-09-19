import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';

describe('room discovery and time extension additive migration', () => {
  it.each([false, true])(
    'migrates an isolated schema with historical rooms=%s',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `room_discovery_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const names = (await readdir('prisma/migrations'))
          .filter((name) => name.startsWith('2026'))
          .sort();
        const index = names.findIndex((name) => name.endsWith('room_discovery_time_extension'));
        expect(index).toBeGreaterThan(0);
        for (const name of names.slice(0, index))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));

        const userId = randomUUID();
        const roomIds = [randomUUID(), randomUUID()];
        if (withData) {
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [userId]);
          await client.query(
            `INSERT INTO "Room" (id,"hostUserId",kind,topic,"cefrLevel",capacity,status,"startedAt","endsAt","initialHostDeadline","updatedAt") VALUES ($1,$3,'INSTANT','Historical instant','B1',4,'OPEN',now(),now()+interval '2 hours',NULL,now()),($2,$3,'APPOINTMENT','Historical appointment','B2',4,'SCHEDULED',now()+interval '1 hour',now()+interval '2 hours',now()+interval '65 minutes',now())`,
            [roomIds[0], roomIds[1], userId],
          );
        }

        await client.query(
          await readFile(`prisma/migrations/${names[index]}/migration.sql`, 'utf8'),
        );

        const columns = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='Room'`,
          [schema],
        );
        expect(columns.rows.map((row) => row.column_name)).toEqual(
          expect.arrayContaining(['visibility', 'shareCode', 'extensionCount']),
        );
        expect(
          (await client.query(`SELECT count(*)::int n FROM "RoomTimeExtension"`)).rows[0].n,
        ).toBe(0);

        if (withData) {
          const rooms = await client.query(
            `SELECT id,visibility,"shareCode","extensionCount" FROM "Room" ORDER BY kind`,
          );
          expect(rooms.rows).toHaveLength(2);
          for (const room of rooms.rows) {
            expect(room.visibility).toBe('PUBLIC');
            expect(room.extensionCount).toBe(0);
            expect(room.shareCode).not.toBe(room.id);
          }
          expect(new Set(rooms.rows.map((room) => room.shareCode)).size).toBe(2);
          await expect(
            client.query(`UPDATE "Room" SET "extensionCount"=4 WHERE id=$1`, [roomIds[0]]),
          ).rejects.toThrow();
        }

        const newRoomId = randomUUID();
        if (!withData)
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [userId]);
        await client.query(
          `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,status,"startedAt","endsAt","updatedAt") VALUES ($1,$2,'Post migration','A2',2,'OPEN',now(),now()+interval '2 hours',now())`,
          [newRoomId, userId],
        );
        expect(
          (
            await client.query(
              `SELECT visibility,"shareCode","extensionCount" FROM "Room" WHERE id=$1`,
              [newRoomId],
            )
          ).rows[0],
        ).toMatchObject({ visibility: 'PUBLIC', extensionCount: 0 });
      } finally {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
