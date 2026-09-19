export type RoomHistoryErrorCode =
  'HISTORY_CONTEXT_NOT_FOUND' | 'ROOM_NOT_ENDED' | 'NOTE_VERSION_CONFLICT' | 'VALIDATION_FAILED';

export class RoomHistoryError extends Error {
  constructor(
    public readonly code: RoomHistoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoomHistoryError';
  }
}
