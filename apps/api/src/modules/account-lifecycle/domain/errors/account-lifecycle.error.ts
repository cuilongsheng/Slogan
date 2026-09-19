export type AccountLifecycleErrorCode =
  | 'ACCOUNT_DELETE_CONFIRMATION_REQUIRED'
  | 'ACCOUNT_DELETE_REQUEST_CONFLICT'
  | 'ACCOUNT_DELETE_ROLE_ACTIVE'
  | 'ACCOUNT_DELETE_UNAVAILABLE'
  | 'RESTRICTED_ACCOUNT_RECORD_DENIED'
  | 'RESTRICTED_ACCOUNT_RECORD_NOT_FOUND';

export class AccountLifecycleError extends Error {
  constructor(
    public readonly code: AccountLifecycleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AccountLifecycleError';
  }
}
