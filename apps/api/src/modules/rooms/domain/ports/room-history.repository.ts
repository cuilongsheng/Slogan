import type {
  RoomHistoryCursor,
  RoomHistoryItem,
  RoomNoteRecord,
} from '../entities/room-history.js';

export const ROOM_HISTORY_REPOSITORY = Symbol('ROOM_HISTORY_REPOSITORY');

export interface RoomHistoryRepository {
  list(input: {
    userId: string;
    limit: number;
    cursor: RoomHistoryCursor | null;
  }): Promise<{ items: RoomHistoryItem[]; nextCursor: RoomHistoryCursor | null }>;
  getNote(roomId: string, userId: string): Promise<RoomNoteRecord>;
  saveNote(input: {
    roomId: string;
    userId: string;
    content: string | null;
    expectedVersion: number;
  }): Promise<RoomNoteRecord>;
}
