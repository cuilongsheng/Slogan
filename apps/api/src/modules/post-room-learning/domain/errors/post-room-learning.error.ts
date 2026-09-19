import { AppError } from '../../../../common/errors/app-error.js';

export class PostRoomLearningError extends AppError {
  static summaryNotFound() {
    return new PostRoomLearningError('KEYWORD_SUMMARY_NOT_FOUND', 'Keyword summary not found', 404);
  }

  static itemNotFound() {
    return new PostRoomLearningError('VOCABULARY_ITEM_NOT_FOUND', 'Vocabulary item not found', 404);
  }

  static versionConflict() {
    return new PostRoomLearningError(
      'VOCABULARY_VERSION_CONFLICT',
      'Vocabulary item version changed',
      409,
    );
  }

  static idempotencyConflict() {
    return new PostRoomLearningError(
      'IDEMPOTENCY_KEY_REUSED',
      'Idempotency key was reused with a different payload',
      409,
    );
  }

  static cursorInvalid() {
    return new PostRoomLearningError('VALIDATION_FAILED', 'Vocabulary cursor is invalid', 400);
  }
}
