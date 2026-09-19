import { createHmac, randomInt, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../../../config/environment.js';
import { ProfilesService } from '../../../profiles/index.js';
import type {
  OAuthExchangeInput,
  OAuthProviderName,
} from '../../domain/entities/provider-identity.js';
import type { PhoneChallengePurpose } from '../../domain/entities/phone-auth.js';
import { AuthError } from '../../domain/errors/auth.error.js';
import { PhonePolicy } from '../../domain/policies/phone.policy.js';
import { AUTH_REPOSITORY, type AuthRepository } from '../../domain/ports/auth.repository.js';
import {
  OAUTH_PROVIDER_REGISTRY,
  type OAuthProviderRegistry,
} from '../../domain/ports/oauth-provider.port.js';
import {
  PHONE_CHALLENGE_STORE,
  type PhoneChallengeStore,
} from '../../domain/ports/phone-challenge.store.js';
import { SMS_PROVIDER, type SmsProvider } from '../../domain/ports/sms-provider.port.js';
import { SessionService } from './session.service.js';

@Injectable()
export class PhoneAuthService {
  private readonly policy: PhonePolicy;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    @Inject(PHONE_CHALLENGE_STORE) private readonly challenges: PhoneChallengeStore,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    @Inject(OAUTH_PROVIDER_REGISTRY) private readonly providers: OAuthProviderRegistry,
    private readonly sessions: SessionService,
    private readonly profiles: ProfilesService,
  ) {
    this.policy = new PhonePolicy(
      config.get('PHONE_IDENTITY_HASH_VERSION', { infer: true }),
      config.get('PHONE_IDENTITY_PEPPER', { infer: true }) ?? 'disabled-phone-identity-pepper',
      new Set(
        (config.get('SMS_SUPPORTED_REGIONS', { infer: true }) ?? '')
          .split(',')
          .map((region) => region.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
  }

  async requestChallenge(input: {
    phone: string;
    defaultRegion?: string;
    purpose: PhoneChallengePurpose;
    userId?: string;
    source: string;
    deviceId: string;
    locale?: string;
  }) {
    this.assertEnabled();
    if (
      input.purpose === 'ACCOUNT_DELETE' &&
      !this.config.get('ACCOUNT_LIFECYCLE_ENABLED', { infer: true })
    ) {
      throw new AuthError('ACCOUNT_DELETE_UNAVAILABLE', 'Account deletion is unavailable');
    }
    if (input.userId) await this.repository.assertActive(input.userId);
    const phone = this.policy.normalize(input.phone, input.defaultRegion);
    if (
      input.purpose === 'ACCOUNT_DELETE' &&
      input.userId &&
      !(await this.repository.ownsPhoneIdentity(input.userId, phone))
    ) {
      throw new AuthError('AUTH_STEP_UP_INVALID', 'Step-up identity is invalid');
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challenge = await this.challenges.issue({
      purpose: input.purpose,
      phone,
      ...(input.userId ? { userId: input.userId } : {}),
      source: input.source,
      deviceId: input.deviceId,
      codeDigest: this.codeDigest(code),
      now: new Date(),
    });
    try {
      await this.sms.send({
        to: phone.e164,
        code,
        template: this.config.get('SMS_PROVIDER_TEMPLATE', { infer: true })!,
        sender: this.config.get('SMS_PROVIDER_SENDER', { infer: true })!,
        ...(input.locale ? { locale: input.locale } : {}),
        correlationId: randomUUID(),
      });
      return challenge;
    } catch (error) {
      await this.challenges.abandon(challenge.challengeId);
      throw error;
    }
  }

  async exchange(input: {
    challengeId: string;
    code: string;
    clientRequestId: string;
    deviceName?: string;
  }) {
    this.assertEnabled();
    const grant = await this.challenges.verify({
      challengeId: input.challengeId,
      purpose: 'LOGIN',
      clientRequestId: input.clientRequestId,
      codeDigest: this.codeDigest(input.code),
      now: new Date(),
    });
    const now = new Date();
    const account = await this.repository.findOrCreatePhoneUser(grant.phone, now);
    const tokens = await this.sessions.issue(account.userId, input.deviceName, now);
    const onboardingState = await this.profiles.getOnboardingState(account.userId, now);
    await this.challenges.completeGrant(grant.grantId, input.clientRequestId);
    return { userId: account.userId, created: account.created, onboardingState, tokens };
  }

  loginMethods(userId: string) {
    return this.repository.listLoginMethods(userId);
  }

  requestLinkChallenge(input: {
    userId: string;
    phone: string;
    defaultRegion?: string;
    source: string;
    deviceId: string;
    locale?: string;
  }) {
    return this.requestChallenge({ ...input, purpose: 'LINK' });
  }

  async confirmPhoneLink(input: {
    userId: string;
    challengeId: string;
    code: string;
    clientRequestId: string;
  }) {
    const grant = await this.challenges.verify({
      challengeId: input.challengeId,
      purpose: 'LINK',
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      codeDigest: this.codeDigest(input.code),
      now: new Date(),
    });
    const result = await this.repository.linkPhoneIdentity(input.userId, grant.phone, new Date());
    await this.challenges.completeGrant(grant.grantId, input.clientRequestId);
    return { result };
  }

  async linkOAuth(userId: string, provider: OAuthProviderName, input: OAuthExchangeInput) {
    await this.repository.assertActive(userId);
    const identity = await this.providers.exchange(provider, input);
    return { result: await this.repository.linkOAuthIdentity(userId, identity, new Date()) };
  }

  requestDeletePhoneChallenge(input: {
    userId: string;
    phone: string;
    defaultRegion?: string;
    source: string;
    deviceId: string;
    locale?: string;
  }) {
    return this.requestChallenge({ ...input, purpose: 'ACCOUNT_DELETE' });
  }

  async confirmDeletePhoneProof(input: {
    userId: string;
    challengeId: string;
    code: string;
    clientRequestId: string;
  }) {
    const grant = await this.challenges.verify({
      challengeId: input.challengeId,
      purpose: 'ACCOUNT_DELETE',
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      codeDigest: this.codeDigest(input.code),
      now: new Date(),
    });
    return { proof: grant.grantId };
  }

  async createDeleteOAuthProof(
    userId: string,
    provider: OAuthProviderName,
    input: OAuthExchangeInput & { clientRequestId: string },
  ) {
    if (!this.config.get('ACCOUNT_LIFECYCLE_ENABLED', { infer: true })) {
      throw new AuthError('ACCOUNT_DELETE_UNAVAILABLE', 'Account deletion is unavailable');
    }
    const identity = await this.providers.exchange(provider, input);
    if (!(await this.repository.ownsOAuthIdentity(userId, identity))) {
      throw new AuthError('AUTH_STEP_UP_INVALID', 'Step-up proof is invalid');
    }
    const grant = await this.challenges.createProof({
      purpose: 'ACCOUNT_DELETE',
      userId,
      clientRequestId: input.clientRequestId,
      now: new Date(),
    });
    return { proof: grant.grantId };
  }

  private assertEnabled(): void {
    if (!this.config.get('PHONE_AUTH_ENABLED', { infer: true })) {
      throw new AuthError('PHONE_AUTH_DISABLED', 'Phone authentication is unavailable');
    }
  }

  private codeDigest(code: string): string {
    return createHmac(
      'sha256',
      this.config.get('PHONE_OTP_CODE_PEPPER', { infer: true }) ?? 'disabled-phone-code-pepper',
    )
      .update(code)
      .digest('hex');
  }
}
