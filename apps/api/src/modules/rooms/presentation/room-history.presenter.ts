import type { RoomHistoryItem, RoomNoteRecord } from '../domain/entities/room-history.js';
import type { RoomHistoryItemDto, RoomNoteDto } from './dto/room-history.dto.js';

export function presentRoomHistoryItem(item: RoomHistoryItem): RoomHistoryItemDto {
  return {
    ...item,
    startedAt: item.startedAt.toISOString(),
    endsAt: item.endsAt.toISOString(),
    occurredAt: item.occurredAt.toISOString(),
  };
}

export function presentRoomNote(note: RoomNoteRecord): RoomNoteDto {
  return {
    content: note.content,
    version: note.version,
    updatedAt: note.updatedAt?.toISOString() ?? null,
  };
}
