import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

import { Client } from 'pg';

describe('account access lifecycle additive migration', () => {
  it.each([false, true])(
    'preserves historical accounts and adds unique identities=%s',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `account_lifecycle_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const names = (await readdir('prisma/migrations'))
          .filter((name) => name.startsWith('2026'))
          .sort();
        const index = names.findIndex((name) => name.endsWith('account_access_lifecycle'));
        expect(index).toBeGreaterThan(0);
        for (const name of names.slice(0, index)) {
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
        }
        const userId = randomUUID();
        if (withData) {
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [userId]);
        }
        await client.query(
          await readFile(`prisma/migrations/${names[index]}/migration.sql`, 'utf8'),
        );
        for (const table of ['PhoneIdentity', 'AccountLifecycleCommand']) {
          expect(
            (
              await client.query(
                'SELECT count(*)::int n FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2',
                [schema, table],
              )
            ).rows[0].n,
          ).toBe(1);
        }
        if (withData) {
          expect(
            (await client.query('SELECT status,"deletedAt" FROM "User" WHERE id=$1', [userId]))
              .rows[0],
          ).toMatchObject({
            status: 'ACTIVE',
            deletedAt: null,
          });
          const phone = [randomUUID(), userId, 'v1', 'a'.repeat(64), '86', '00'];
          await client.query(
            'INSERT INTO "PhoneIdentity" (id,"userId","phoneLookupVersion","phoneLookupHash","countryCallingCode","lastTwo","verifiedAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now(),now())',
            phone,
          );
          await expect(
            client.query(
              'INSERT INTO "PhoneIdentity" (id,"userId","phoneLookupVersion","phoneLookupHash","countryCallingCode","lastTwo","verifiedAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now(),now())',
              [randomUUID(), userId, 'v1', 'b'.repeat(64), '86', '11'],
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
