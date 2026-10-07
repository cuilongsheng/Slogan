import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';

test('range/message migrations preserve legacy rooms, backfill combined levels and enforce both bounds', async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const schema = `room_experience_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const names = (await readdir('prisma/migrations'))
      .filter((name) => name.startsWith('2026'))
      .sort();
    const index = names.indexOf('20261007100000_room_level_ranges');
    expect(index).toBeGreaterThan(0);
    for (const name of names.slice(0, index))
      await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
    const user = randomUUID(),
      legacy = randomUUID(),
      historical = randomUUID();
    await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [user]);
    await client.query(
      `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,status,"startedAt","endsAt","updatedAt") VALUES ($1,$3,'Legacy range','B1_B2',4,'OPEN',now(),now()+interval '2 hours',now()),($2,$3,'Historical room','C1',4,'ENDED',now()-interval '2 hours',now()-interval '1 hour',now())`,
      [legacy, historical, user],
    );
    for (const name of names.slice(index))
      await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
    const rows = await client.query(
      'SELECT id,"cefrLevel","cefrLevelMin","cefrLevelMax",status FROM "Room"',
    );
    expect(rows.rows).toEqual(
      expect.arrayContaining([
        { id: legacy, cefrLevel: 'B1_B2', cefrLevelMin: 'B1', cefrLevelMax: 'B2', status: 'OPEN' },
        {
          id: historical,
          cefrLevel: 'C1',
          cefrLevelMin: 'C1',
          cefrLevelMax: 'C1',
          status: 'ENDED',
        },
      ]),
    );
    for (const [min, max] of [
      ['C1', 'A2'],
      ['B1', 'B1_B2'],
      ['B1_B2', 'C1'],
      ['B1', null],
    ]) {
      await expect(
        client.query('UPDATE "Room" SET "cefrLevelMin"=$1,"cefrLevelMax"=$2 WHERE id=$3', [
          min,
          max,
          legacy,
        ]),
      ).rejects.toThrow();
    }
    await client.query('UPDATE "Room" SET "cefrLevelMin"=NULL,"cefrLevelMax"=NULL WHERE id=$1', [
      legacy,
    ]); // Old writers remain supported.
    expect((await client.query('SELECT count(*)::int n FROM "RoomTextMessage"')).rows[0].n).toBe(0);
    const constraints = await client.query(
      "SELECT confupdtype,confdeltype FROM pg_constraint WHERE connamespace=$1::regnamespace AND conrelid='\"RoomTextMessage\"'::regclass AND contype='f'",
      [schema],
    );
    expect(constraints.rows).toEqual([
      { confupdtype: 'c', confdeltype: 'c' },
      { confupdtype: 'c', confdeltype: 'c' },
    ]);
  } finally {
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
