import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

describe('preview additive migration against an existing email database', () => {
  it('preserves verifiedAt, hash, version, sessions and audit while enforcing origin and slot constraints', async () => {
    const client = new pg.Client({
      connectionString: 'postgresql://slogan:slogan@127.0.0.1:54329/slogan_test',
    });
    await client.connect();
    try {
      await client.query('BEGIN');
      const schema = 'preview_migration_' + randomUUID().replaceAll('-', '');
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      const root = resolve('prisma/migrations');
      const latest = '20261003000000_preview_experience_accounts';
      for (const dir of (await readdir(root)).filter((d) => /^\d/.test(d) && d < latest).sort())
        await client.query(await readFile(resolve(root, dir, 'migration.sql'), 'utf8'));
      const userId = randomUUID(),
        sessionId = randomUUID(),
        auditId = randomUUID();
      await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [userId]);
      await client.query(
        'INSERT INTO "EmailCredential" ("userId",username,email,"passwordHash","credentialVersion","verifiedAt","updatedAt") VALUES ($1,$2,$3,$4,7,$5,now())',
        [
          userId,
          'verified_fixture',
          'fixture@example.test',
          'isolated-hash-marker',
          '2026-09-01T00:00:00Z',
        ],
      );
      await client.query(
        'INSERT INTO "AuthSession" (id,"userId","expiresAt","updatedAt") VALUES ($1,$2,now()+interval \'1 day\',now())',
        [sessionId, userId],
      );
      await client.query(
        "INSERT INTO \"BackofficeAuditEvent\" (id,\"actorType\",\"actorRoles\",action,\"targetType\",result) VALUES ($1,'SYSTEM_BOOTSTRAP','{}','BACKOFFICE_BOOTSTRAPPED','USER','SUCCEEDED')",
        [auditId],
      );
      const before = (await client.query('SELECT * FROM "EmailCredential"')).rows[0];
      const session = (await client.query('SELECT * FROM "AuthSession"')).rows;
      const audit = (await client.query('SELECT * FROM "BackofficeAuditEvent"')).rows;
      await client.query(await readFile(resolve(root, latest, 'migration.sql'), 'utf8'));
      expect((await client.query('SELECT * FROM "EmailCredential"')).rows[0]).toEqual({
        ...before,
        origin: 'EMAIL_VERIFIED',
      });
      expect((await client.query('SELECT * FROM "AuthSession"')).rows).toEqual(session);
      expect((await client.query('SELECT * FROM "BackofficeAuditEvent"')).rows).toEqual(audit);
      await client.query('SAVEPOINT constraints');
      await expect(
        client.query('UPDATE "EmailCredential" SET origin=\'PREVIEW_PROVISIONED\''),
      ).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT constraints');
      await client.query(
        'UPDATE "EmailCredential" SET origin=\'PREVIEW_PROVISIONED\',"verifiedAt"=NULL',
      );
      await client.query(
        'INSERT INTO "PreviewAccountProvisioning" ("userId","environmentId",slot,"batchId","grantCommandId","revokeCommandId") VALUES ($1,\'isolated\',\'ADMIN\',$2,$3,$4)',
        [userId, randomUUID(), randomUUID(), randomUUID()],
      );
      expect(
        (await client.query('SELECT count(*) FROM "PreviewAccountProvisioning"')).rows[0].count,
      ).toBe('1');
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  });
});
