import { AppError } from '../../../../common/errors/app-error.js';

export class SafetyError extends AppError {
  static denied() {
    return new SafetyError('SAFETY_ACCESS_DENIED', 'Safety access is denied', 403);
  }
  static caseNotFound() {
    return new SafetyError('SAFETY_CASE_NOT_FOUND', 'Safety case was not found', 404);
  }
  static restrictionNotFound() {
    return new SafetyError('SAFETY_RESTRICTION_NOT_FOUND', 'Safety restriction was not found', 404);
  }
  static appealNotFound() {
    return new SafetyError('SAFETY_APPEAL_NOT_FOUND', 'Safety appeal was not found', 404);
  }
  static stateConflict() {
    return new SafetyError('SAFETY_STATE_CONFLICT', 'Safety state changed', 409);
  }
  static requestConflict() {
    return new SafetyError(
      'SAFETY_REQUEST_CONFLICT',
      'The request identifier was already used for different content',
      409,
    );
  }
  static appealClosed() {
    return new SafetyError('SAFETY_APPEAL_CLOSED', 'The appeal window is closed', 409);
  }
  static validation() {
    return new SafetyError('VALIDATION_FAILED', 'Request validation failed', 400);
  }
  static lastAdmin() {
    return new SafetyError(
      'LAST_PLATFORM_ADMIN_REQUIRED',
      'At least one active platform administrator is required',
      409,
    );
  }
}
