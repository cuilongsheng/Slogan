import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';

describe('room history notes additive migration', () => {
  it.each([false, true])(
    'upgrades an isolated schema with retained room history=%s',
    async (withData) => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const schema = `history_notes_${randomUUID().replaceAll('-', '')}`;
      try {
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET search_path TO "${schema}"`);
        const migrations = (await readdir('prisma/migrations'))
          .filter((name) => name.startsWith('2026'))
          .sort();
        const migrationIndex = migrations.findIndex((name) => name.endsWith('room_history_notes'));
        expect(migrationIndex).toBeGreaterThan(0);
        for (const name of migrations.slice(0, migrationIndex)) {
          await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
        }

        const hostId = randomUUID();
        const memberId = randomUUID();
        const roomId = randomUUID();
        const hostMembershipId = randomUUID();
        const memberMembershipId = randomUUID();
        const reportId = randomUUID();
        const eventId = randomUUID();
        if (withData) {
          await client.query('INSERT INTO "User" (id,"updatedAt") VALUES ($1,now()),($2,now())', [
            hostId,
            memberId,
          ]);
          await client.query(
            `INSERT INTO "Room" (id,"hostUserId",topic,"cefrLevel",capacity,status,"startedAt","endsAt","endedAt","updatedAt") VALUES ($1,$2,'Retained history','B1',3,'ENDED',now()-interval '2 hours',now()-interval '1 hour',now()-interval '1 hour',now())`,
            [roomId, hostId],
          );
          for (const [id, userId, role, joinOrder, lifecycle] of [
            [hostMembershipId, hostId, 'HOST', 1, 'LEFT'],
            [memberMembershipId, memberId, 'MEMBER', 2, 'REMOVED'],
          ]) {
            await client.query(
              `INSERT INTO "RoomMembership" (id,"roomId","userId",role,lifecycle,"joinOrder","rulesVersion","rulesAcceptedAt","joinedAt","participantIdentity") VALUES ($1,$2,$3,$4,$5,$6,'v1',now()-interval '2 hours',now()-interval '2 hours',$7)`,
              [id, roomId, userId, role, lifecycle, joinOrder, randomUUID()],
            );
          }
          await client.query(
            `INSERT INTO "RoomReservation" (id,"roomId","userId",status) VALUES ($1,$2,$3,'CONSUMED')`,
            [randomUUID(), roomId, memberId],
          );
          await client.query(
            `INSERT INTO "RealtimeIdentity" (identity,"roomId","membershipId","credentialVersion","issueUntil","revokedAt") VALUES ($1,$2,$3,0,now()-interval '1 hour',now()-interval '1 hour')`,
            [randomUUID(), roomId, memberMembershipId],
          );
          await client.query(
            `INSERT INTO "Report" (id,"roomId","reporterUserId","targetUserId","clientRequestId",category,description) VALUES ($1,$2,$3,$4,$5,'OTHER','retained report')`,
            [reportId, roomId, memberId, hostId, randomUUID()],
          );
          await client.query(
            `INSERT INTO "RoomEvent" (id,"roomId",type,source,result,"occurredAt") VALUES ($1,$2,'room_ended','server','COMPLETED',now()-interval '1 hour')`,
            [eventId, roomId],
          );
        }

        await client.query(
          await readFile(`prisma/migrations/${migrations[migrationIndex]}/migration.sql`, 'utf8'),
        );
        expect((await client.query('SELECT count(*)::int AS n FROM "RoomNote"')).rows[0].n).toBe(0);

        if (withData) {
          expect(
            (
              await client.query(
                'SELECT (SELECT count(*) FROM "RoomMembership")::int AS memberships,(SELECT count(*) FROM "RoomReservation")::int AS reservations,(SELECT count(*) FROM "RealtimeIdentity")::int AS identities,(SELECT count(*) FROM "Report")::int AS reports,(SELECT count(*) FROM "RoomEvent")::int AS events',
              )
            ).rows[0],
          ).toEqual({ memberships: 2, reservations: 1, identities: 1, reports: 1, events: 1 });
          await client.query(
            'INSERT INTO "RoomNote" (id,"roomId","userId",content,"updatedAt") VALUES ($1,$2,$3,$4,now())',
            [randomUUID(), roomId, memberId, 'retained private note'],
          );
          await expect(client.query('DELETE FROM "Room" WHERE id=$1', [roomId])).rejects.toThrow();
          await expect(
            client.query('DELETE FROM "User" WHERE id=$1', [memberId]),
          ).rejects.toThrow();
          await expect(client.query('UPDATE "RoomNote" SET version=0')).rejects.toThrow();
          await expect(
            client.query('UPDATE "RoomNote" SET content=$1', ['😀'.repeat(2001)]),
          ).rejects.toThrow();
        }
      } finally {
        await client.query('SET search_path TO public');
        await client.query(`DROP SCHEMA "${schema}" CASCADE`);
        await client.end();
      }
    },
  );
});
