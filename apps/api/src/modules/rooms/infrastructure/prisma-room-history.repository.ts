import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { RoomHistoryItem, RoomNoteRecord } from '../domain/entities/room-history.js';
import type { RoomStatus } from '../domain/entities/room.js';
import { RoomHistoryError } from '../domain/errors/room-history.error.js';
import type { RoomHistoryRepository } from '../domain/ports/room-history.repository.js';
import { runRoomTransactionWithRetry } from './transaction-retry.js';

interface HistoryRow {
  roomId: string;
  kind: string;
  topic: string;
  cefrLevel: string;
  status: string;
  startedAt: Date;
  endsAt: Date;
  occurredAt: Date;
  relationship: string;
  membershipLifecycle: string | null;
  membershipRole: string | null;
  reservationStatus: string | null;
  noteExists: boolean;
}

@Injectable()
export class PrismaRoomHistoryRepository implements RoomHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: Parameters<RoomHistoryRepository['list']>[0]) {
    const cursorCondition =
      input.cursor === null
        ? Prisma.empty
        : Prisma.sql`AND (
            relationships."occurredAt" < ${input.cursor.occurredAt}
            OR (
              relationships."occurredAt" = ${input.cursor.occurredAt}
              AND relationships."roomId" < ${input.cursor.roomId}::uuid
            )
          )`;
    const rows = await this.prisma.$queryRaw<HistoryRow[]>(Prisma.sql`
      WITH relationships AS (
        SELECT
          membership."roomId",
          membership."joinedAt" AS "occurredAt",
          'PARTICIPATED'::text AS relationship,
          membership.lifecycle::text AS "membershipLifecycle",
          membership.role::text AS "membershipRole",
          NULL::text AS "reservationStatus"
        FROM "RoomMembership" membership
        WHERE membership."userId" = ${input.userId}::uuid

        UNION ALL

        SELECT
          reservation."roomId",
          reservation."bookedAt" AS "occurredAt",
          'RESERVED_ONLY'::text AS relationship,
          NULL::text AS "membershipLifecycle",
          NULL::text AS "membershipRole",
          reservation.status::text AS "reservationStatus"
        FROM "RoomReservation" reservation
        WHERE reservation."userId" = ${input.userId}::uuid
          AND NOT EXISTS (
            SELECT 1
            FROM "RoomMembership" membership
            WHERE membership."roomId" = reservation."roomId"
              AND membership."userId" = reservation."userId"
          )
      )
      SELECT
        relationships."roomId",
        room.kind::text AS kind,
        room.topic,
        room."cefrLevel"::text AS "cefrLevel",
        room.status::text AS status,
        room."startedAt",
        room."endsAt",
        relationships."occurredAt",
        relationships.relationship,
        relationships."membershipLifecycle",
        relationships."membershipRole",
        relationships."reservationStatus",
        EXISTS (
          SELECT 1 FROM "RoomNote" note
          WHERE note."roomId" = relationships."roomId"
            AND note."userId" = ${input.userId}::uuid
            AND note.content IS NOT NULL
        ) AS "noteExists"
      FROM relationships
      INNER JOIN "Room" room ON room.id = relationships."roomId"
      WHERE true ${cursorCondition}
      ORDER BY relationships."occurredAt" DESC, relationships."roomId" DESC
      LIMIT ${input.limit + 1}
    `);
    const hasMore = rows.length > input.limit;
    const pageRows = rows.slice(0, input.limit);
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((row) => this.toHistoryItem(row)),
      nextCursor:
        hasMore && last !== undefined ? { occurredAt: last.occurredAt, roomId: last.roomId } : null,
    };
  }

  async getNote(roomId: string, userId: string): Promise<RoomNoteRecord> {
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { room: { select: { status: true } } },
    });
    if (membership === null) {
      throw new RoomHistoryError('HISTORY_CONTEXT_NOT_FOUND', 'Room history context not found');
    }
    this.assertEnded(membership.room.status as RoomStatus);
    const note = await this.prisma.roomNote.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    return note === null
      ? { content: null, version: 0, updatedAt: null }
      : { content: note.content, version: note.version, updatedAt: note.updatedAt };
  }

  async saveNote(input: Parameters<RoomHistoryRepository['saveNote']>[0]) {
    return runRoomTransactionWithRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string; status: string }>>(
          Prisma.sql`SELECT id, status::text FROM "Room" WHERE id = ${input.roomId}::uuid FOR UPDATE`,
        );
        const membership = await transaction.roomMembership.findUnique({
          where: { roomId_userId: { roomId: input.roomId, userId: input.userId } },
          select: { id: true },
        });
        if (locked.length === 0 || membership === null) {
          throw new RoomHistoryError('HISTORY_CONTEXT_NOT_FOUND', 'Room history context not found');
        }
        this.assertEnded(locked[0]!.status as RoomStatus);
        const existing = await transaction.roomNote.findUnique({
          where: { roomId_userId: { roomId: input.roomId, userId: input.userId } },
        });
        if (
          existing !== null &&
          existing.version === input.expectedVersion + 1 &&
          existing.content === input.content
        ) {
          return this.toNote(existing);
        }
        if ((existing?.version ?? 0) !== input.expectedVersion) {
          throw new RoomHistoryError('NOTE_VERSION_CONFLICT', 'Room note version changed');
        }
        const saved =
          existing === null
            ? await transaction.roomNote.create({
                data: { roomId: input.roomId, userId: input.userId, content: input.content },
              })
            : await transaction.roomNote.update({
                where: { id: existing.id },
                data: { content: input.content, version: { increment: 1 } },
              });
        return this.toNote(saved);
      }),
    );
  }

  private assertEnded(status: RoomStatus): void {
    if (status !== 'ENDING' && status !== 'ENDED') {
      throw new RoomHistoryError('ROOM_NOT_ENDED', 'Room notes are available after the room ends');
    }
  }

  private toNote(note: { content: string | null; version: number; updatedAt: Date }) {
    return { content: note.content, version: note.version, updatedAt: note.updatedAt };
  }

  private toHistoryItem(row: HistoryRow): RoomHistoryItem {
    return {
      roomId: row.roomId,
      kind: row.kind as RoomHistoryItem['kind'],
      topic: row.topic,
      cefrLevel: row.cefrLevel,
      status: row.status as RoomHistoryItem['status'],
      startedAt: row.startedAt,
      endsAt: row.endsAt,
      occurredAt: row.occurredAt,
      relationship: row.relationship as RoomHistoryItem['relationship'],
      membershipLifecycle: row.membershipLifecycle as RoomHistoryItem['membershipLifecycle'],
      membershipRole: row.membershipRole as RoomHistoryItem['membershipRole'],
      reservationStatus: row.reservationStatus as RoomHistoryItem['reservationStatus'],
      noteExists: row.noteExists,
    };
  }
}
