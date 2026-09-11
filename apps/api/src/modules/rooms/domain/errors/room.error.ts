export type RoomErrorCode =
  | 'PROFILE_REQUIRED'
  | 'AGE_RESTRICTED'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_ENDED'
  | 'ROOM_FULL'
  | 'ROOM_PASSWORD_REQUIRED'
  | 'ROOM_PASSWORD_INVALID'
  | 'ROOM_RULES_NOT_ACCEPTED'
  | 'ROOM_CONFIGURATION_INVALID'
  | 'VALIDATION_FAILED';

export class RoomError extends Error {
  constructor(
    public readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}
