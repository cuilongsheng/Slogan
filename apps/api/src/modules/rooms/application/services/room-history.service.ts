import { Inject, Injectable } from '@nestjs/common';

import type { RoomHistoryCursor } from '../../domain/entities/room-history.js';
import { RoomHistoryError } from '../../domain/errors/room-history.error.js';
import {
  ROOM_HISTORY_REPOSITORY,
  type RoomHistoryRepository,
} from '../../domain/ports/room-history.repository.js';
import { RoomNotePolicy } from '../../domain/policies/room-note.policy.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RoomHistoryService {
  constructor(
    @Inject(ROOM_HISTORY_REPOSITORY) private readonly repository: RoomHistoryRepository,
    private readonly policy: RoomNotePolicy,
  ) {}

  async list(userId: string, input: { limit?: number; cursor?: string }) {
    const page = await this.repository.list({
      userId,
      limit: input.limit ?? 20,
      cursor: input.cursor === undefined ? null : this.decodeCursor(input.cursor),
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor === null ? null : this.encodeCursor(page.nextCursor),
    };
  }

  getNote(userId: string, roomId: string) {
    return this.repository.getNote(roomId, userId);
  }

  saveNote(userId: string, roomId: string, input: { content: string; expectedVersion: number }) {
    this.policy.assertExpectedVersion(input.expectedVersion);
    return this.repository.saveNote({
      roomId,
      userId,
      content: this.policy.normalize(input.content),
      expectedVersion: input.expectedVersion,
    });
  }

  private encodeCursor(cursor: RoomHistoryCursor): string {
    return Buffer.from(
      JSON.stringify({ occurredAt: cursor.occurredAt.toISOString(), roomId: cursor.roomId }),
    ).toString('base64url');
  }

  private decodeCursor(cursor: string): RoomHistoryCursor {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
      if (
        typeof decoded !== 'object' ||
        decoded === null ||
        !('occurredAt' in decoded) ||
        typeof decoded.occurredAt !== 'string' ||
        !('roomId' in decoded) ||
        typeof decoded.roomId !== 'string' ||
        !UUID.test(decoded.roomId)
      ) {
        throw new Error('Invalid room history cursor');
      }
      const occurredAt = new Date(decoded.occurredAt);
      if (Number.isNaN(occurredAt.getTime()) || occurredAt.toISOString() !== decoded.occurredAt) {
        throw new Error('Invalid room history cursor timestamp');
      }
      return { occurredAt, roomId: decoded.roomId };
    } catch {
      throw new RoomHistoryError('VALIDATION_FAILED', 'Room history cursor is invalid');
    }
  }
}
