import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';

describe('room sensitive speech additive migration', () => {
  it.each([false, true])(
    'migrates historical rooms with data=%s and defaults detection off',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = 'room_speech_' + randomUUID().replaceAll('-', '');
      try {
        await client.query('CREATE SCHEMA "' + schema + '"');
        await client.query('SET search_path TO "' + schema + '"');
        const names = (await readdir('prisma/migrations'))
          .filter((name) => name.startsWith('2026'))
          .sort();
        const index = names.findIndex((name) => name.endsWith('room_sensitive_speech_detection'));
        expect(index).toBeGreaterThan(0);
        for (const name of names.slice(0, index))
          await client.query(
            await readFile('prisma/migrations/' + name + '/migration.sql', 'utf8'),
          );
        if (withData) {
          const userId = randomUUID();
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [userId]);
          await client.query(
            'INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,"startedAt","endsAt","updatedAt") VALUES ($1,$2,$3,\'B1\',3,now(),now()+interval \'1 hour\',now())',
            [randomUUID(), userId, 'Existing room'],
          );
        }
        await client.query(
          await readFile('prisma/migrations/' + names[index] + '/migration.sql', 'utf8'),
        );
        for (const table of [
          'RoomSpeechRiskEvent',
          'RoomSpeechAlertDelivery',
          'SafetyCapabilityIncident',
        ]) {
          const result = await client.query(
            'SELECT count(*)::int n FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2',
            [schema, table],
          );
          expect(result.rows[0].n).toBe(1);
        }
        if (withData) {
          const result = await client.query(
            'SELECT "sensitiveSpeechDetectionEnabled" enabled FROM "Room"',
          );
          expect(result.rows).toEqual([{ enabled: false }]);
        }
      } finally {
        await client.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
        await client.end();
      }
    },
  );
});
