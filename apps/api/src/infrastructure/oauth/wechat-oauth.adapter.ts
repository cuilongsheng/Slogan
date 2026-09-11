import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../config/environment.js';
import {
  AuthError,
  type OAuthExchangeInput,
  type ProviderIdentity,
} from '../../modules/auth/index.js';
import { fetchJson, requireAllowedRedirect } from './oauth-http.js';

@Injectable()
export class WechatOAuthAdapter {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async exchange(input: OAuthExchangeInput): Promise<ProviderIdentity> {
    if (!this.config.get('WECHAT_OAUTH_ENABLED', { infer: true })) {
      throw new AuthError('AUTH_PROVIDER_UNAVAILABLE', 'WeChat OAuth is not configured');
    }
    const clientId = this.config.get('WECHAT_OAUTH_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('WECHAT_OAUTH_CLIENT_SECRET', { infer: true });
    requireAllowedRedirect(
      input.redirectUri,
      this.config.get('WECHAT_OAUTH_REDIRECT_URIS', { infer: true }),
    );

    const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    url.searchParams.set('appid', clientId!);
    url.searchParams.set('secret', clientSecret!);
    url.searchParams.set('code', input.authorizationCode);
    url.searchParams.set('grant_type', 'authorization_code');
    const body = await fetchJson(
      url,
      { method: 'GET' },
      this.config.get('OAUTH_HTTP_TIMEOUT_MS', { infer: true }),
    );
    if (typeof body.errcode === 'number' || typeof body.openid !== 'string') {
      throw new AuthError('AUTH_CODE_REJECTED', 'WeChat rejected the authorization code');
    }

    const unionId = typeof body.unionid === 'string' ? body.unionid : undefined;
    return {
      provider: 'WECHAT',
      issuer:
        unionId === undefined
          ? `https://open.weixin.qq.com/app/${encodeURIComponent(clientId!)}`
          : 'https://open.weixin.qq.com/unionid',
      subject: unionId ?? body.openid,
    };
  }
}
