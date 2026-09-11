import { Injectable } from '@nestjs/common';

import {
  AuthError,
  type OAuthExchangeInput,
  type OAuthProviderName,
  type OAuthProviderRegistry,
  type ProviderIdentity,
} from '../../modules/auth/index.js';
import { GoogleOAuthAdapter } from './google-oauth.adapter.js';
import { WechatOAuthAdapter } from './wechat-oauth.adapter.js';

@Injectable()
export class DefaultOAuthProviderRegistry implements OAuthProviderRegistry {
  constructor(
    private readonly google: GoogleOAuthAdapter,
    private readonly wechat: WechatOAuthAdapter,
  ) {}

  async exchange(
    provider: OAuthProviderName,
    input: OAuthExchangeInput,
  ): Promise<ProviderIdentity> {
    if (provider === 'GOOGLE') return this.google.exchange(input);
    if (provider === 'WECHAT') return this.wechat.exchange(input);
    throw new AuthError('AUTH_PROVIDER_INVALID', 'OAuth provider is not supported');
  }
}
