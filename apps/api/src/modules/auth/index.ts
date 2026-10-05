export { AuthError } from './domain/errors/auth.error.js';
export { AuthService } from './application/services/auth.service.js';
export { SessionService } from './application/services/session.service.js';
export { PhoneAuthService } from './application/services/phone-auth.service.js';
export { PHONE_CHALLENGE_STORE } from './domain/ports/phone-challenge.store.js';
export type { PhoneChallengeStore } from './domain/ports/phone-challenge.store.js';
export { AUTH_REPOSITORY } from './domain/ports/auth.repository.js';
export type { AuthRepository, RotateRefreshResult } from './domain/ports/auth.repository.js';
export { OAUTH_PROVIDER_REGISTRY } from './domain/ports/oauth-provider.port.js';
export type { OAuthProviderRegistry } from './domain/ports/oauth-provider.port.js';
export type {
  OAuthExchangeInput,
  OAuthProviderName,
  ProviderIdentity,
} from './domain/entities/provider-identity.js';
export type { LoginMethodView, PhoneFingerprint } from './domain/entities/phone-auth.js';
export { PhonePolicy } from './domain/policies/phone.policy.js';
export { SMS_PROVIDER } from './domain/ports/sms-provider.port.js';
export type { SmsProvider } from './domain/ports/sms-provider.port.js';

export { EmailAuthService } from './application/services/email-auth.service.js';
export { AuthMailService } from './application/services/auth-mail.service.js';
export { EmailAuthError } from './domain/errors/email-auth.error.js';

export { PreviewAccountsService } from './application/services/preview-accounts.service.js';
export { PREVIEW_SLOTS } from './domain/ports/preview-accounts.repository.js';
export type {
  PreviewSlot,
  PreviewAccountInput,
  PreviewAccountState,
} from './domain/ports/preview-accounts.repository.js';
