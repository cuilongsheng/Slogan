import { Inject, Injectable } from '@nestjs/common';

import { ProfilesService, type OnboardingState } from '../../../profiles/index.js';
import type { TokenPair } from '../../domain/entities/auth-session.js';
import type {
  OAuthExchangeInput,
  OAuthProviderName,
  ProviderIdentity,
} from '../../domain/entities/provider-identity.js';
import { AUTH_REPOSITORY, type AuthRepository } from '../../domain/ports/auth.repository.js';
import {
  OAUTH_PROVIDER_REGISTRY,
  type OAuthProviderRegistry,
} from '../../domain/ports/oauth-provider.port.js';
import { SessionService } from './session.service.js';

export interface LoginResult {
  userId: string;
  created: boolean;
  onboardingState: OnboardingState;
  tokens: TokenPair;
  suggestedProfile?: ProviderIdentity['suggestedProfile'];
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(OAUTH_PROVIDER_REGISTRY) private readonly providers: OAuthProviderRegistry,
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    private readonly sessions: SessionService,
    private readonly profiles: ProfilesService,
  ) {}

  async exchange(
    provider: OAuthProviderName,
    input: OAuthExchangeInput & { deviceName?: string },
    now = new Date(),
  ): Promise<LoginResult> {
    const identity = await this.providers.exchange(provider, input);
    const account = await this.repository.findOrCreateUser(identity, now);
    const tokens = await this.sessions.issue(account.userId, input.deviceName, now);
    return {
      userId: account.userId,
      created: account.created,
      onboardingState: await this.profiles.getOnboardingState(account.userId, now),
      tokens,
      ...(identity.suggestedProfile === undefined
        ? {}
        : { suggestedProfile: identity.suggestedProfile }),
    };
  }
}
