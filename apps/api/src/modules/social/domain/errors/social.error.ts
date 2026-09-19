export type SocialErrorCode =
  | 'SOCIAL_TARGET_UNAVAILABLE'
  | 'SOCIAL_REQUEST_NOT_FOUND'
  | 'SOCIAL_REQUEST_STATE_CONFLICT'
  | 'SOCIAL_RELATIONSHIP_NOT_FOUND'
  | 'SOCIAL_REQUEST_CONFLICT'
  | 'SOCIAL_PRESENCE_UNAVAILABLE'
  | 'SOCIAL_ACCESS_RESTRICTED'
  | 'SOCIAL_CURSOR_INVALID';

export class SocialError extends Error {
  constructor(
    public readonly code: SocialErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'SocialError';
  }
}
