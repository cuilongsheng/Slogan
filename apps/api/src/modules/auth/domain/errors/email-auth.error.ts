export type EmailAuthErrorCode =
  | 'EMAIL_AUTH_UNAVAILABLE'
  | 'EMAIL_AUTH_RATE_LIMITED'
  | 'EMAIL_USERNAME_INVALID'
  | 'EMAIL_ADDRESS_INVALID'
  | 'EMAIL_PASSWORD_INVALID'
  | 'EMAIL_PASSWORD_WEAK'
  | 'EMAIL_USERNAME_TAKEN'
  | 'EMAIL_ADDRESS_TAKEN'
  | 'EMAIL_CREDENTIALS_INVALID'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'EMAIL_TOKEN_INVALID'
  | 'EMAIL_COMMAND_CONFLICT';

export class EmailAuthError extends Error {
  constructor(public readonly code: EmailAuthErrorCode) {
    super(code);
    this.name = 'EmailAuthError';
  }
}
