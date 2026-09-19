import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';

describe('social availability and invitations additive migration', () => {
  it.each([false, true])(
    'migrates an isolated schema with historical data=%s',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `social_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const names = (await readdir('prisma/migrations'))
          .filter((name) => name.startsWith('2026'))
          .sort();
        const index = names.findIndex((name) => name.endsWith('social_availability_invitations'));
        expect(index).toBeGreaterThan(0);
        for (const name of names.slice(0, index))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));

        const users = [randomUUID(), randomUUID()];
        if (withData) {
          for (const id of users)
            await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [id]);
        }

        await client.query(
          await readFile(`prisma/migrations/${names[index]}/migration.sql`, 'utf8'),
        );
        for (const table of [
          'FriendRequest',
          'Friendship',
          'UserBlock',
          'SocialCommand',
          'RoomInvitation',
        ]) {
          expect(
            (
              await client.query(
                `SELECT count(*)::int n FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
                [schema, table],
              )
            ).rows[0].n,
          ).toBe(1);
        }
        if (withData) {
          expect((await client.query('SELECT count(*)::int n FROM "User"')).rows[0].n).toBe(2);
          await expect(
            client.query(
              `INSERT INTO "FriendRequest" (id,"requesterUserId","recipientUserId","userLowId","userHighId","updatedAt") VALUES ($1,$2,$2,$2,$2,now())`,
              [randomUUID(), users[0]],
            ),
          ).rejects.toThrow();
        }
      } finally {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
