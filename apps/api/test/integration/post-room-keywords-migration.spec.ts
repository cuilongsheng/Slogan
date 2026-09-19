import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';

describe('post-room keywords and vocabulary additive migration', () => {
  it.each([false, true])(
    'upgrades an isolated schema with historical rooms=%s',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `post_room_learning_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const migrations = (await readdir('prisma/migrations'))
          .filter((name) => name.startsWith('2026'))
          .sort();
        const migrationIndex = migrations.findIndex((name) =>
          name.endsWith('post_room_keywords_vocabulary'),
        );
        expect(migrationIndex).toBeGreaterThan(0);
        for (const name of migrations.slice(0, migrationIndex))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));

        const userId = randomUUID();
        const roomId = randomUUID();
        if (withData) {
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [userId]);
          await client.query(
            `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,status,"startedAt","endsAt","updatedAt")
           VALUES ($1,$2,'Historical room','B1',3,'ENDED',now()-interval '2 hours',now()-interval '1 hour',now())`,
            [roomId, userId],
          );
        }

        await client.query(
          await readFile(`prisma/migrations/${migrations[migrationIndex]}/migration.sql`, 'utf8'),
        );

        const tables = (
          await client.query(
            `SELECT table_name FROM information_schema.tables WHERE table_schema=$1`,
            [schema],
          )
        ).rows.map(({ table_name }: { table_name: string }) => table_name);
        expect(tables).toEqual(
          expect.arrayContaining([
            'RoomKeywordSummary',
            'RoomKeywordSummaryItem',
            'RoomKeywordSummaryJob',
            'VocabularyItem',
            'VocabularyCommand',
          ]),
        );
        if (withData) {
          expect(
            (
              await client.query('SELECT "postRoomKeywordsEnabled" FROM "Room" WHERE id=$1', [
                roomId,
              ])
            ).rows[0],
          ).toEqual({ postRoomKeywordsEnabled: false });
          await expect(
            client.query('UPDATE "Room" SET "postRoomKeywordsEnabled"=true WHERE id=$1', [roomId]),
          ).rejects.toThrow('immutable');
        }
      } finally {
        await client.query('SET search_path TO public');
        await client.query(`DROP SCHEMA "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
