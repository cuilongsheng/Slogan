import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';

describe('operations data governance additive migration', () => {
  it.each([false, true])(
    'preserves historical users and installs fenced governance tables=%s',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `operations_governance_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const names = (await readdir('prisma/migrations'))
          .filter((name) => name.startsWith('2026'))
          .sort();
        const index = names.findIndex((name) => name.endsWith('operations_data_governance'));
        expect(index).toBeGreaterThan(0);
        for (const name of names.slice(0, index))
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
        const userId = randomUUID();
        const targetUserId = randomUUID();
        const historicalTables: string[] = [];
        if (withData) {
          const roomId = randomUUID();
          const hostMembershipId = randomUUID();
          const targetMembershipId = randomUUID();
          const reportId = randomUUID();
          const caseId = randomUUID();
          const restrictionId = randomUUID();
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now()),($2,now())', [
            userId,
            targetUserId,
          ]);
          await client.query(
            `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,"startedAt","endsAt","updatedAt") VALUES ($1,$2,'Historical room','B1',3,now()-interval '1 hour',now()+interval '1 hour',now())`,
            [roomId, userId],
          );
          await client.query(
            `INSERT INTO "RoomMembership" (id,"roomId","userId",role,"joinOrder","rulesVersion","rulesAcceptedAt","joinedAt","participantIdentity") VALUES ($1,$2,$3,'HOST',1,'v1',now(),now(),$6),($4,$2,$5,'MEMBER',2,'v1',now(),now(),$7)`,
            [
              hostMembershipId,
              roomId,
              userId,
              targetMembershipId,
              targetUserId,
              randomUUID(),
              randomUUID(),
            ],
          );
          await client.query(
            `INSERT INTO "RoomReservation" (id,"roomId","userId") VALUES ($1,$2,$3)`,
            [randomUUID(), roomId, targetUserId],
          );
          await client.query(
            `INSERT INTO "AiExpressionRequest" (id,"userId","roomId","clientRequestId","inputMode","inputDigest","inputSize","updatedAt") VALUES ($1,$2,$3,$4,'TEXT',$5,4,now())`,
            [randomUUID(), userId, roomId, randomUUID(), 'a'.repeat(64)],
          );
          await client.query(
            `INSERT INTO "SpeechProcessingConsentEvent" (id,"userId","clientRequestId",purpose,action,"noticeVersion","providerCategory") VALUES ($1,$2,$3,'AI_EXPRESSION_AUDIO','ACCEPT','v1','FAKE')`,
            [randomUUID(), userId, randomUUID()],
          );
          await client.query(
            `INSERT INTO "Report" (id,"roomId","reporterUserId","targetUserId","clientRequestId",category,description) VALUES ($1,$2,$3,$4,$5,'OTHER','historical report')`,
            [reportId, roomId, userId, targetUserId, randomUUID()],
          );
          await client.query(
            `INSERT INTO "SafetyCase" (id,"reportId","roomId","targetUserId","updatedAt") VALUES ($1,$2,$3,$4,now())`,
            [caseId, reportId, roomId, targetUserId],
          );
          await client.query(
            `INSERT INTO "SafetyRestriction" (id,"caseId","userId",kind,severity,reason,"decidedByUserId","startsAt","endsAt","appealDeadlineAt","updatedAt") VALUES ($1,$2,$3,'TEMPORARY','GENERAL','historical',$4,now(),now()+interval '12 hours',now()+interval '30 minutes',now())`,
            [restrictionId, caseId, targetUserId, userId],
          );
          await client.query(
            `INSERT INTO "SafetyAppeal" (id,"restrictionId","userId",reason) VALUES ($1,$2,$3,'historical appeal')`,
            [randomUUID(), restrictionId, targetUserId],
          );
          await client.query(
            `INSERT INTO "BackofficeAuditEvent" (id,"actorType","actorUserId","actorRoles",action,"targetType",result) VALUES ($1,'USER',$2,ARRAY['PLATFORM_ADMIN']::"BackofficeRole"[],'SAFETY_CASE_VIEWED','SAFETY_CASE','SUCCEEDED')`,
            [randomUUID(), userId],
          );
          await client.query(
            `INSERT INTO "RealtimeCommand" (id,key,"roomId",type,"stateVersion") VALUES ($1,$2,$3,'SYNC_ROOM_TIME',1)`,
            [randomUUID(), `historical:${randomUUID()}`, roomId],
          );
          historicalTables.push(
            'User',
            'Room',
            'RoomMembership',
            'RoomReservation',
            'AiExpressionRequest',
            'SpeechProcessingConsentEvent',
            'Report',
            'SafetyCase',
            'SafetyRestriction',
            'SafetyAppeal',
            'BackofficeAuditEvent',
            'RealtimeCommand',
          );
        }
        await client.query(
          await readFile(`prisma/migrations/${names[index]}/migration.sql`, 'utf8'),
        );
        const expected = [
          'MetricSnapshot',
          'OperationalIncident',
          'OperationalAlertDelivery',
          'RetentionPolicyVersion',
          'RetentionDryRun',
          'RetentionRun',
          'RetentionRunBatch',
          'RetentionHold',
          'DeletionEvidence',
          'RecoveryDrill',
          'RoomShareAttribution',
        ];
        const tables = await client.query(
          'SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_name=ANY($2)',
          [schema, expected],
        );
        expect(tables.rowCount).toBe(expected.length);
        if (withData) {
          expect(
            (await client.query('SELECT count(*)::int n FROM "User" WHERE id=$1', [userId])).rows[0]
              .n,
          ).toBe(1);
          for (const table of historicalTables)
            expect((await client.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n).toBe(
              table === 'User' || table === 'RoomMembership' ? 2 : 1,
            );
        }
        const partial = await client.query(
          `SELECT count(*)::int n FROM pg_indexes WHERE schemaname=$1 AND indexdef LIKE '%WHERE%' AND tablename IN ('OperationalIncident','RetentionPolicyVersion')`,
          [schema],
        );
        expect(partial.rows[0].n).toBeGreaterThanOrEqual(2);
      } finally {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
