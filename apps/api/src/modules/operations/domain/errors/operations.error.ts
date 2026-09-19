import { AppError } from '../../../../common/errors/app-error.js';

export class OperationsError extends AppError {
  static unavailable() {
    return new OperationsError(
      'OPERATIONS_GOVERNANCE_UNAVAILABLE',
      'Operations governance is unavailable',
      503,
    );
  }

  static invalid() {
    return new OperationsError('OPERATIONS_VALIDATION_FAILED', 'Request validation failed', 400);
  }

  static notFound() {
    return new OperationsError('OPERATIONS_RESOURCE_NOT_FOUND', 'Resource was not found', 404);
  }

  static conflict(code = 'OPERATIONS_REQUEST_CONFLICT') {
    return new OperationsError(code, 'Operation conflicts with current state', 409);
  }
}
