export const OAUTH_PROVIDERS = ['GOOGLE', 'WECHAT'] as const;
export type OAuthProviderName = (typeof OAUTH_PROVIDERS)[number];

export interface OAuthExchangeInput {
  authorizationCode: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface ProviderIdentity {
  provider: OAuthProviderName;
  issuer: string;
  subject: string;
  suggestedProfile?: {
    displayName?: string;
    avatarUrl?: string;
  };
}
