export { AuthError } from './domain/errors/auth.error.js';
export { AuthService } from './application/services/auth.service.js';
export { SessionService } from './application/services/session.service.js';
export { AUTH_REPOSITORY } from './domain/ports/auth.repository.js';
export type { AuthRepository, RotateRefreshResult } from './domain/ports/auth.repository.js';
export { OAUTH_PROVIDER_REGISTRY } from './domain/ports/oauth-provider.port.js';
export type { OAuthProviderRegistry } from './domain/ports/oauth-provider.port.js';
export type {
  OAuthExchangeInput,
  OAuthProviderName,
  ProviderIdentity,
} from './domain/entities/provider-identity.js';
