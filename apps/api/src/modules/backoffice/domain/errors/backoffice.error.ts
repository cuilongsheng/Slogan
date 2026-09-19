import { AppError } from '../../../../common/errors/app-error.js';

export class BackofficeError extends AppError {
  static denied() {
    return new BackofficeError('BACKOFFICE_ACCESS_DENIED', 'Backoffice access is denied', 403);
  }

  static userNotFound() {
    return new BackofficeError(
      'BACKOFFICE_USER_NOT_FOUND',
      'Backoffice target user was not found',
      404,
    );
  }

  static lastAdmin() {
    return new BackofficeError(
      'LAST_PLATFORM_ADMIN_REQUIRED',
      'At least one active platform administrator is required',
      409,
    );
  }

  static conflict() {
    return new BackofficeError(
      'BACKOFFICE_REQUEST_CONFLICT',
      'The request identifier was already used for different content',
      409,
    );
  }
}
