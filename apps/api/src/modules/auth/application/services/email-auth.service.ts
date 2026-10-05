import { createHmac, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import { ProfilesService } from '../../../profiles/index.js';
import type { AccessIdentity } from '../../domain/entities/auth-session.js';
import type {
  OAuthExchangeInput,
  OAuthProviderName,
} from '../../domain/entities/provider-identity.js';
import { EmailAuthError } from '../../domain/errors/email-auth.error.js';
import {
  assertNewPassword,
  assertPasswordInput,
  normalizeEmail,
  normalizeUsername,
} from '../../domain/policies/email-password.policy.js';
import {
  EMAIL_AUTH_REPOSITORY,
  type EmailAuthRepository,
} from '../../domain/ports/email-auth.repository.js';
import {
  EMAIL_SECURITY,
  EMAIL_QUOTA,
  type EmailSecurity,
  type EmailQuota,
} from '../../domain/ports/email-security.port.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/ports/password-hasher.port.js';
import { AUTH_REPOSITORY, type AuthRepository } from '../../domain/ports/auth.repository.js';
import {
  OAUTH_PROVIDER_REGISTRY,
  type OAuthProviderRegistry,
} from '../../domain/ports/oauth-provider.port.js';
import {
  PHONE_CHALLENGE_STORE,
  type PhoneChallengeStore,
} from '../../domain/ports/phone-challenge.store.js';
import { SessionService } from './session.service.js';
import { PhoneAuthService } from './phone-auth.service.js';

@Injectable()
export class EmailAuthService {
  constructor(
    @Inject(EMAIL_AUTH_REPOSITORY) private readonly repository: EmailAuthRepository,
    @Inject(EMAIL_SECURITY) private readonly security: EmailSecurity,
    @Inject(EMAIL_QUOTA) private readonly quota: EmailQuota,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(AUTH_REPOSITORY) private readonly identities: AuthRepository,
    @Inject(OAUTH_PROVIDER_REGISTRY) private readonly providers: OAuthProviderRegistry,
    @Inject(PHONE_CHALLENGE_STORE) private readonly phones: PhoneChallengeStore,
    private readonly phone: PhoneAuthService,
    private readonly sessions: SessionService,
    private readonly profiles: ProfilesService,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  async register(
    input: { username: string; email: string; password: string },
    source: string,
    now = new Date(),
    link?: AccessIdentity & { proof: string; clientRequestId: string },
  ) {
    this.mailEnabled();
    const username = normalizeUsername(input.username),
      email = normalizeEmail(input.email);
    assertNewPassword(input.password);
    await this.quota.consume({ source, target: email, mail: true });
    const managementToken = this.security.newToken();
    const challenge = this.newChallenge(email, link ? 'LINK' : 'REGISTER');
    const row = await this.repository.enroll({
      id: randomUUID(),
      username,
      email,
      passwordHash: await this.hasher.hash(input.password),
      managementDigest: this.security.digest(managementToken),
      challenge,
      now,
      ...(link
        ? {
            link: {
              userId: link.userId,
              sessionId: link.sessionId,
              commandId: link.clientRequestId,
              proofDigests: this.security.digests(link.proof),
              payloadHash: this.security
                .fingerprint(
                  JSON.stringify({
                    username,
                    email,
                    password: input.password,
                    sessionId: link.sessionId,
                  }),
                )
                .split(':')[1]!,
            },
          }
        : {}),
    });
    return {
      managementToken,
      expiresAt: row.expiresAt.toISOString(),
      resendAt: new Date(now.getTime() + 60000).toISOString(),
    };
  }
  async resend(managementToken: string, source: string, now = new Date()) {
    this.mailEnabled();
    const row = await this.repository.findEnrollment(this.security.digests(managementToken), now);
    await this.quota.consume({
      source,
      target: row?.email ?? managementToken,
      mail: true,
      cooldown: row?.id ?? managementToken,
    });
    if (!row?.email) throw new EmailAuthError('EMAIL_TOKEN_INVALID');
    await this.repository.resend(row.id, this.newChallenge(row.email, row.purpose), now);
    return { resendAt: new Date(now.getTime() + 60000).toISOString() };
  }
  async confirm(token: string, source: string, now = new Date(), identity?: AccessIdentity) {
    this.mailEnabled();
    await this.quota.consume({ source, target: token, mail: false });
    await this.repository.confirm(
      this.security.digests(token),
      identity ? 'LINK' : 'REGISTER',
      now,
      identity,
    );
    return { verified: true };
  }
  async login(
    input: { username: string; password: string; deviceName?: string },
    source: string,
    now = new Date(),
  ) {
    this.enabled();
    const username = normalizeUsername(input.username);
    assertPasswordInput(input.password);
    await this.quota.consume({ source, target: username, mail: false });
    const credential = await this.repository.credential(username);
    const correct = await this.hasher.verify(input.password, credential?.passwordHash ?? null);
    if (!credential) {
      const pending = await this.repository.pending(username, now);
      let matched = false;
      for (const hash of pending)
        if (await this.hasher.verify(input.password, hash)) matched = true;
      if (matched) throw new EmailAuthError('EMAIL_VERIFICATION_REQUIRED');
    }
    if (!credential?.active || !correct) throw new EmailAuthError('EMAIL_CREDENTIALS_INVALID');
    const tokens = await this.sessions.issue(
      credential.userId,
      input.deviceName,
      now,
      credential.credentialVersion,
    );
    return {
      userId: credential.userId,
      created: false,
      onboardingState: await this.profiles.getOnboardingState(credential.userId, now),
      tokens: { ...tokens, refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString() },
    };
  }
  async requestReset(emailInput: string, source: string, now = new Date()) {
    this.mailEnabled();
    const email = normalizeEmail(emailInput);
    await this.quota.consume({ source, target: email, mail: true });
    await this.repository.requestReset(email, this.newChallenge(email, 'RESET_PASSWORD'), now);
    return { accepted: true };
  }
  async reset(token: string, password: string, source: string, now = new Date()) {
    this.mailEnabled();
    assertNewPassword(password);
    await this.quota.consume({ source, target: token, mail: false });
    await this.repository.reset(
      this.security.digests(token),
      await this.hasher.hash(password),
      now,
    );
  }
  async oauthProof(
    identity: AccessIdentity,
    provider: OAuthProviderName,
    input: OAuthExchangeInput & { clientRequestId: string },
    source: string,
  ) {
    this.mailEnabled();
    await this.quota.consume({ source, target: identity.userId, mail: false });
    const verified = await this.providers.exchange(provider, input);
    if (!(await this.identities.ownsOAuthIdentity(identity.userId, verified)))
      throw new EmailAuthError('EMAIL_TOKEN_INVALID');
    return this.proof(identity, input.clientRequestId, 'LINK_EMAIL');
  }
  async phoneChallenge(
    identity: AccessIdentity,
    input: { phone: string; defaultRegion?: string; deviceId: string; locale?: string },
    source: string,
  ) {
    this.mailEnabled();
    await this.quota.consume({ source, target: identity.userId, mail: false });
    return this.phone.requestChallenge({
      ...input,
      purpose: 'LINK_EMAIL',
      userId: identity.userId,
      source,
    });
  }
  async phoneProof(
    identity: AccessIdentity,
    input: { challengeId: string; code: string; clientRequestId: string },
    source: string,
  ) {
    this.mailEnabled();
    await this.quota.consume({ source, target: identity.userId, mail: false });
    const grant = await this.phones.verify({
      challengeId: input.challengeId,
      purpose: 'LINK_EMAIL',
      userId: identity.userId,
      clientRequestId: input.clientRequestId,
      codeDigest: createHmac(
        'sha256',
        this.config.get('PHONE_OTP_CODE_PEPPER', { infer: true }) ?? 'disabled',
      )
        .update(input.code)
        .digest('hex'),
      now: new Date(),
    });
    if (!(await this.identities.ownsPhoneIdentity(identity.userId, grant.phone)))
      throw new EmailAuthError('EMAIL_TOKEN_INVALID');
    const proof = await this.proof(identity, input.clientRequestId, 'LINK_EMAIL');
    await this.phones.completeGrant(grant.grantId, input.clientRequestId);
    return proof;
  }
  async passwordProof(
    identity: AccessIdentity,
    password: string,
    commandId: string,
    source: string,
  ) {
    this.enabled();
    if (!this.config.get('ACCOUNT_LIFECYCLE_ENABLED', { infer: true }))
      throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
    assertPasswordInput(password);
    await this.quota.consume({ source, target: identity.userId, mail: false });
    const c = await this.repository.credentialForUser(identity.userId);
    const correct = await this.hasher.verify(password, c?.passwordHash ?? null);
    if (!correct || !c?.active) throw new EmailAuthError('EMAIL_CREDENTIALS_INVALID');
    return this.proof(identity, commandId, 'ACCOUNT_DELETE', c.credentialVersion);
  }
  deletionProofDigests(proof: string): string[] {
    this.enabled();
    return this.security.digests(proof.slice('email:'.length));
  }
  private async proof(
    identity: AccessIdentity,
    commandId: string,
    purpose: 'LINK_EMAIL' | 'ACCOUNT_DELETE',
    credentialVersion?: number,
  ) {
    const token = this.security.newToken(),
      now = new Date();
    await this.repository.createProof({
      id: randomUUID(),
      ...identity,
      commandId,
      purpose,
      tokenDigest: this.security.digest(token),
      ...(credentialVersion === undefined ? {} : { credentialVersion }),
      now,
    });
    return { proof: purpose === 'ACCOUNT_DELETE' ? `email:${token}` : token };
  }
  private newChallenge(to: string, purpose: 'REGISTER' | 'LINK' | 'RESET_PASSWORD') {
    const token = this.security.newToken(),
      deliveryId = randomUUID();
    return {
      id: randomUUID(),
      deliveryId,
      tokenDigest: this.security.digest(token),
      ...this.security.encrypt(deliveryId, { to, token, purpose }),
    };
  }
  private mailEnabled() {
    this.enabled();
    if (!(
      this.config.get('EMAIL_AUTH_MAIL_ENABLED', { infer: true }) ??
      this.config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true })
    ))
      throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
  }
  private enabled() {
    if (!this.config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true }))
      throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
  }
}
