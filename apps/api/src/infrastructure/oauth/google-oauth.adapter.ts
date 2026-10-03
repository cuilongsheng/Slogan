import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import type { Environment } from '../../config/environment.js';
import {
  AuthError,
  type OAuthExchangeInput,
  type ProviderIdentity,
} from '../../modules/auth/index.js';
import { fetchJson, requireAllowedRedirect } from './oauth-http.js';

@Injectable()
export class GoogleOAuthAdapter {
  private readonly verifier = new OAuth2Client();
  private readonly logger = new Logger(GoogleOAuthAdapter.name);

  constructor(private readonly config: ConfigService<Environment, true>) {}

  async exchange(input: OAuthExchangeInput): Promise<ProviderIdentity> {
    if (!this.config.get('GOOGLE_OAUTH_ENABLED', { infer: true })) {
      throw new AuthError('AUTH_PROVIDER_UNAVAILABLE', 'Google OAuth is not configured');
    }
    const clientId = this.config.get('GOOGLE_OAUTH_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('GOOGLE_OAUTH_CLIENT_SECRET', { infer: true });
    requireAllowedRedirect(
      input.redirectUri,
      this.config.get('GOOGLE_OAUTH_REDIRECT_URIS', { infer: true }),
    );

    const form = new URLSearchParams({
      code: input.authorizationCode,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: input.redirectUri === 'slogan://oauth/google/native' ? '' : input.redirectUri,
      grant_type: 'authorization_code',
    });
    if (input.codeVerifier !== undefined) form.set('code_verifier', input.codeVerifier);

    const timeout = this.config.get('OAUTH_HTTP_TIMEOUT_MS', { infer: true });
    const token = await fetchJson(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form,
      },
      timeout,
      (status, providerError) =>
        this.logger.warn({ event: 'google_token_exchange_rejected', status, providerError }),
    );
    if (typeof token.id_token !== 'string') {
      throw new AuthError('AUTH_CODE_REJECTED', 'Google did not return an identity token');
    }

    let claims;
    try {
      const ticket = await this.verifier.verifyIdToken({
        idToken: token.id_token,
        audience: clientId!,
      });
      claims = ticket.getPayload();
    } catch {
      throw new AuthError('AUTH_CODE_REJECTED', 'Google identity token validation failed');
    }
    if (!claims)
      throw new AuthError('AUTH_CODE_REJECTED', 'Google identity token validation failed');
    const issuer = claims.iss;
    const subject = claims.sub;
    const audience = claims.aud;
    const expiresAt = Number(claims.exp) * 1000;
    if (
      typeof issuer !== 'string' ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(issuer) ||
      typeof subject !== 'string' ||
      audience !== clientId ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      throw new AuthError('AUTH_CODE_REJECTED', 'Google identity token validation failed');
    }

    return {
      provider: 'GOOGLE',
      issuer: 'https://accounts.google.com',
      subject,
      suggestedProfile: {
        ...(typeof claims.name === 'string' ? { displayName: claims.name } : {}),
        ...(typeof claims.picture === 'string' ? { avatarUrl: claims.picture } : {}),
      },
    };
  }
}
