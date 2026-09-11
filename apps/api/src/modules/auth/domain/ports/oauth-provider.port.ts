import type {
  OAuthExchangeInput,
  OAuthProviderName,
  ProviderIdentity,
} from '../entities/provider-identity.js';

export const OAUTH_PROVIDER_REGISTRY = Symbol('OAUTH_PROVIDER_REGISTRY');

export interface OAuthProviderRegistry {
  exchange(provider: OAuthProviderName, input: OAuthExchangeInput): Promise<ProviderIdentity>;
}
