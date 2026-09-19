import { AppError } from '../../../../common/errors/app-error.js';

export class RoomSpeechSafetyError extends AppError {
  static unavailable() {
    return new RoomSpeechSafetyError(
      'ROOM_SPEECH_UNAVAILABLE',
      'Room speech detection is unavailable',
      503,
    );
  }

  static hostRequired() {
    return new RoomSpeechSafetyError(
      'ROOM_HOST_REQUIRED',
      'Current host permission is required',
      403,
    );
  }

  static cursorInvalid() {
    return new RoomSpeechSafetyError('VALIDATION_FAILED', 'Cursor is invalid', 400);
  }
}
