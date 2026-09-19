import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

import { Client } from 'pg';

describe('AI expression and STT foundation additive migration', () => {
  it.each([false, true])(
    'migrates the complete historical chain with data=%s',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `assistance_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const names = (await readdir('prisma/migrations'))
          .filter((name) => name.startsWith('2026'))
          .sort();
        const index = names.findIndex((name) => name.endsWith('ai_expression_stt_foundation'));
        expect(index).toBeGreaterThan(0);
        for (const name of names.slice(0, index))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));

        const userId = randomUUID();
        const roomId = randomUUID();
        if (withData) {
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now())', [userId]);
          await client.query(
            `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,"startedAt","endsAt","updatedAt") VALUES ($1,$2,'Existing room','B1',3,now(),now()+interval '1 hour',now())`,
            [roomId, userId],
          );
        }

        await client.query(
          await readFile(`prisma/migrations/${names[index]}/migration.sql`, 'utf8'),
        );
        for (const table of [
          'AiExpressionRequest',
          'AiUsageLedger',
          'SpeechProcessingConsentEvent',
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
          expect((await client.query('SELECT count(*)::int n FROM "User"')).rows[0].n).toBe(1);
          expect((await client.query('SELECT count(*)::int n FROM "Room"')).rows[0].n).toBe(1);
          await client.query(
            `INSERT INTO "AiExpressionRequest" (id,"userId","roomId","clientRequestId","inputMode","inputDigest","inputSize","updatedAt") VALUES ($1,$2,$3,$4,'TEXT',$5,1,now())`,
            [randomUUID(), userId, roomId, randomUUID(), 'a'.repeat(64)],
          );
          expect(
            (await client.query('SELECT count(*)::int n FROM "AiExpressionRequest"')).rows[0].n,
          ).toBe(1);
        }
      } finally {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
