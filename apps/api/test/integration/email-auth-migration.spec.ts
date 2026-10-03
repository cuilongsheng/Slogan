import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';

describe('email authentication additive migration', () => {
  it.each([false, true])(
    'preserves historical identities and sessions (fixtures=%s)',
    async (fixtures) => {
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      await db.connect();
      const schema = `email_migration_${randomUUID().replaceAll('-', '')}`;
      try {
        await db.query(`CREATE SCHEMA "${schema}"`);
        await db.query(`SET search_path TO "${schema}"`);
        const migrations = (await readdir('prisma/migrations'))
          .filter((n) => n.startsWith('2026'))
          .sort();
        const index = migrations.findIndex((n) => n.endsWith('_email_password_auth'));
        expect(index).toBeGreaterThan(0);
        for (const name of migrations.slice(0, index)) {
          await db.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
        }
        const user = randomUUID();
        const deleted = randomUUID();
        if (fixtures) {
          await db.query('INSERT INTO "User" (id, "updatedAt") VALUES ($1,now())', [user]);
          await db.query(
            'INSERT INTO "User" (id,status,"deletedAt","updatedAt") VALUES ($1,\'DELETED\',now(),now())',
            [deleted],
          );
          for (const id of [user, deleted]) {
            await db.query(
              'INSERT INTO "OAuthIdentity" (id,provider,issuer,subject,"userId","updatedAt") VALUES ($1,\'GOOGLE\',\'fixture\',$2::text,$2::uuid,now())',
              [randomUUID(), id],
            );
            await db.query(
              'INSERT INTO "PhoneIdentity" (id,"userId","phoneLookupVersion","phoneLookupHash","countryCallingCode","lastTwo","verifiedAt","updatedAt") VALUES ($1,$2,\'v1\',$3,\'86\',\'00\',now(),now())',
              [randomUUID(), id, id.replaceAll('-', '').padEnd(64, '0')],
            );
            await db.query(
              'INSERT INTO "AuthSession" (id,"userId","expiresAt","revokedAt","updatedAt") VALUES ($1,$2,now()+interval \'1 day\',$3,now())',
              [randomUUID(), id, id === deleted ? new Date() : null],
            );
          }
        }
        const tables = ['User', 'OAuthIdentity', 'PhoneIdentity', 'AuthSession'];
        const before = [];
        for (const t of tables) before.push(await db.query(`SELECT * FROM "${t}" ORDER BY id`));
        await db.query(
          await readFile(`prisma/migrations/${migrations[index]}/migration.sql`, 'utf8'),
        );
        for (let i = 0; i < tables.length; i++) {
          expect((await db.query(`SELECT * FROM "${tables[i]}" ORDER BY id`)).rows).toEqual(
            before[i]!.rows,
          );
        }
        for (const table of [
          'EmailCredential',
          'EmailEnrollment',
          'EmailChallenge',
          'EmailAuthProof',
          'EmailDelivery',
        ]) {
          expect((await db.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n).toBe(0);
        }
        if (fixtures) {
          await db.query(
            'INSERT INTO "EmailCredential" ("userId",username,email,"verifiedAt","updatedAt") VALUES ($1,\'held_name\',\'held@example.test\',now(),now())',
            [deleted],
          );
          await expect(
            db.query(
              'INSERT INTO "EmailCredential" ("userId",username,email,"verifiedAt","updatedAt") VALUES ($1,\'held_name\',\'other@example.test\',now(),now())',
              [user],
            ),
          ).rejects.toMatchObject({ code: '23505' });
          await expect(
            db.query(
              'INSERT INTO "EmailCredential" ("userId",username,email,"verifiedAt","updatedAt") VALUES ($1,\'other_name\',\'held@example.test\',now(),now())',
              [user],
            ),
          ).rejects.toMatchObject({ code: '23505' });
        }
      } finally {
        await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await db.end();
      }
    },
  );
});
