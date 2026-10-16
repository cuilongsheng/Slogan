import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';

it.each([false, true])(
  'additive monitoring migration preserves existing facts (fixtures=%s)',
  async (fixtures) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const schema = `observability_${randomUUID().replaceAll('-', '')}`;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      const migrations = (await readdir('prisma/migrations'))
        .filter((name) => name.startsWith('2026'))
        .sort();
      const target = migrations.indexOf('20261014100000_observability_monitor_state');
      expect(target).toBeGreaterThan(0);
      for (const name of migrations.slice(0, target))
        await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
      if (fixtures) {
        const user = randomUUID(),
          room = randomUUID(),
          incident = randomUUID();
        await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [user]);
        await client.query(
          'INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,"startedAt","endsAt","updatedAt") VALUES ($1,$2,\'Synthetic migration room\',\'B1\',4,now(),now()+interval \'1 hour\',now())',
          [room, user],
        );
        await client.query(
          'INSERT INTO "RealtimeCommand" (id,key,"roomId",type,"stateVersion") VALUES ($1,\'synthetic-command\',$2,\'DELETE_ROOM\',1)',
          [randomUUID(), room],
        );
        await client.query(
          'INSERT INTO "OperationalIncident" (id,fingerprint,occurrence,component,category,severity,"scopeType","scopeKey","ruleVersion","reasonCode","firstObservedAt","lastObservedAt","updatedAt") VALUES ($1,$2,1,\'POSTGRESQL\',\'READINESS\',\'WARNING\',\'GLOBAL\',\'configured-provider\',\'readiness-v1\',\'POSTGRESQL_UNAVAILABLE\',now(),now(),now())',
          [incident, 'a'.repeat(64)],
        );
        await client.query(
          'INSERT INTO "OperationalAlertDelivery" (id,"incidentId","updatedAt") VALUES ($1,$2,now())',
          [randomUUID(), incident],
        );
      }
      const snapshot = async () =>
        Promise.all(
          [
            'User',
            'Room',
            'RealtimeCommand',
            'OperationalIncident',
            'OperationalAlertDelivery',
          ].map((table) =>
            client
              .query(`SELECT row_to_json(t) AS fact FROM "${table}" t ORDER BY id`)
              .then((result) => result.rows),
          ),
        );
      const before = await snapshot();
      await client.query(
        await readFile(`prisma/migrations/${migrations[target]}/migration.sql`, 'utf8'),
      );
      expect(await snapshot()).toEqual(before);
      await client.query(
        'INSERT INTO "ObservabilityMonitorState" (environment,"monitorKey","updatedAt") VALUES (\'test\',\'SCAN\',now())',
      );
      await expect(
        client.query(
          'INSERT INTO "ObservabilityMonitorState" (environment,"monitorKey","updatedAt") VALUES (\'test\',\'SCAN\',now())',
        ),
      ).rejects.toThrow();
      expect(
        (
          await client.query(
            'SELECT "completedWindow","consecutiveFailures" FROM "ObservabilityMonitorState"',
          )
        ).rows,
      ).toEqual([{ completedWindow: '-1', consecutiveFailures: 0 }]);
    } finally {
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  },
);
