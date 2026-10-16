import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

test('additive event migration preserves legacy rows and bounded latest/delta plans on a large history', async () => {
  const client = new Client({
    connectionString: process.env.SLOGAN_TEST_DATABASE_URL ?? process.env.DATABASE_URL,
  });
  await client.connect();
  const schema = `unified_migration_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const names = (await readdir('prisma/migrations')).filter((n) => n.startsWith('2026')).sort();
    const target = names.findIndex((n) => n.endsWith('unified_mobile_events'));
    expect(target).toBeGreaterThan(0);
    for (const name of names.slice(0, target))
      await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
    const a = randomUUID(),
      b = randomUUID(),
      conversation = randomUUID();
    await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now()),($2,now())', [a, b]);
    await client.query('DELETE FROM "LiveUpdateOutbox"');
    await client.query(
      `INSERT INTO "LiveUpdateOutbox" (scope,"ownerId") VALUES ('rooms',null),('partners',null),('messages',$1)`,
      [a],
    );
    await client.query(await readFile(`prisma/migrations/${names[target]}/migration.sql`, 'utf8'));
    expect(
      (await client.query('SELECT scope,"ownerId","resourceId",kind FROM "LiveUpdateOutbox"')).rows,
    ).toEqual(
      expect.arrayContaining([
        { scope: 'rooms', ownerId: null, resourceId: null, kind: null },
        { scope: 'partners', ownerId: null, resourceId: null, kind: null },
        { scope: 'messages', ownerId: a, resourceId: null, kind: null },
      ]),
    );
    await expect(
      client.query(`INSERT INTO "LiveUpdateOutbox" (scope) VALUES ('inbox')`),
    ).rejects.toThrow();
    const low = a < b ? a : b,
      high = a < b ? b : a;
    await client.query(
      `INSERT INTO "DirectConversation" (id,"userLowId","userHighId","initiatorUserId","nextSequence") VALUES ($1,$2,$3,$2,10001)`,
      [conversation, low, high],
    );
    await client.query(
      `INSERT INTO "DirectMessage" (id,"conversationId","senderUserId","clientRequestId",sequence,text) SELECT gen_random_uuid(),$1,$2,gen_random_uuid(),n,'Large history fixture' FROM generate_series(1,10000) n`,
      [conversation, a],
    );
    await client.query('ANALYZE "DirectMessage"');
    for (const order of ['DESC', 'ASC']) {
      const plan = (
        await client.query(
          `EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM "DirectMessage" WHERE "conversationId"=$1 AND sequence>9900 AND sequence<=10000 ORDER BY sequence ${order} LIMIT 21`,
          [conversation],
        )
      ).rows[0]['QUERY PLAN'][0].Plan;
      expect(plan['Actual Rows']).toBe(21);
      expect(JSON.stringify(plan)).toContain('DirectMessage_conversationId_sequence_key');
      expect(JSON.stringify(plan)).toContain('Index Scan');
    }
    // A failed business transaction cannot publish either generation of invalidation.
    await client.query('DELETE FROM "LiveUpdateOutbox"');
    await client.query('BEGIN');
    await client.query(`UPDATE "User" SET "status"='DISABLED',"updatedAt"=now() WHERE id=$1`, [a]);
    await client.query('ROLLBACK');
    expect((await client.query('SELECT count(*)::int n FROM "LiveUpdateOutbox"')).rows[0].n).toBe(
      0,
    );
  } finally {
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
}, 30000);
