export type AuthErrorCode =
  | 'AUTH_PROVIDER_INVALID'
  | 'AUTH_PROVIDER_UNAVAILABLE'
  | 'AUTH_CODE_REJECTED'
  | 'AUTH_PROVIDER_TIMEOUT'
  | 'ACCESS_TOKEN_INVALID'
  | 'REFRESH_TOKEN_INVALID'
  | 'REFRESH_TOKEN_REUSED';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
