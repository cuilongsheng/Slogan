import type { RoomStatus } from '../entities/room.js';
import { RoomHistoryError } from '../errors/room-history.error.js';

function isForbiddenControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0)!;
  return (
    codePoint <= 0x08 ||
    codePoint === 0x0b ||
    codePoint === 0x0c ||
    (codePoint >= 0x0e && codePoint <= 0x1f) ||
    codePoint === 0x7f
  );
}

export class RoomNotePolicy {
  normalize(content: string): string | null {
    if (typeof content !== 'string') {
      throw new RoomHistoryError('VALIDATION_FAILED', 'Note content must be text');
    }
    const characters = Array.from(content);
    if (characters.some(isForbiddenControlCharacter) || characters.length > 2000) {
      throw new RoomHistoryError('VALIDATION_FAILED', 'Note content is invalid');
    }
    return content.trim().length === 0 ? null : content;
  }

  assertExpectedVersion(version: number): void {
    if (!Number.isSafeInteger(version) || version < 0) {
      throw new RoomHistoryError('VALIDATION_FAILED', 'Note version is invalid');
    }
  }

  assertEnded(status: RoomStatus): void {
    if (status !== 'ENDING' && status !== 'ENDED') {
      throw new RoomHistoryError('ROOM_NOT_ENDED', 'Room notes are available after the room ends');
    }
  }
}
