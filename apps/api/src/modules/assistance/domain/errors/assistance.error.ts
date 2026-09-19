export type AssistanceErrorCode =
  | 'ASSISTANCE_UNAVAILABLE'
  | 'ASSISTANCE_CONTEXT_UNAVAILABLE'
  | 'ASSISTANCE_REQUEST_CONFLICT'
  | 'ASSISTANCE_IN_PROGRESS'
  | 'ASSISTANCE_RESULT_EXPIRED'
  | 'ASSISTANCE_RATE_LIMITED'
  | 'ASSISTANCE_QUOTA_EXCEEDED'
  | 'ASSISTANCE_PROVIDER_TIMEOUT'
  | 'ASSISTANCE_PROVIDER_UNAVAILABLE'
  | 'ASSISTANCE_PROVIDER_RESPONSE_INVALID'
  | 'ASSISTANCE_AUDIO_INVALID'
  | 'ASSISTANCE_CONSENT_REQUIRED'
  | 'POST_ROOM_KEYWORDS_UNAVAILABLE'
  | 'POST_ROOM_KEYWORDS_CONSENT_REQUIRED'
  | 'ASSISTANCE_REQUEST_FAILED';

export class AssistanceError extends Error {
  constructor(
    public readonly code: AssistanceErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AssistanceError';
  }
}
