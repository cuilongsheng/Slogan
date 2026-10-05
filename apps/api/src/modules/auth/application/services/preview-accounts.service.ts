import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import { ProfilesService } from '../../../profiles/index.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/ports/password-hasher.port.js';
import {
  PREVIEW_ACCOUNTS_REPOSITORY,
  PREVIEW_SLOTS,
  type PreviewAccountInput,
  type PreviewAccountsRepository,
} from '../../domain/ports/preview-accounts.repository.js';
import {
  normalizeUsername,
  assertNewPassword,
} from '../../domain/policies/email-password.policy.js';
import { EmailAuthError } from '../../domain/errors/email-auth.error.js';
@Injectable()
export class PreviewAccountsService {
  constructor(
    @Inject(PREVIEW_ACCOUNTS_REPOSITORY) private readonly repository: PreviewAccountsRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly profiles: ProfilesService,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  private environment(environmentId: string) {
    if (
      !this.config.get('PREVIEW_ACCOUNTS_ENABLED', { infer: true }) ||
      !this.config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true }) ||
      !environmentId ||
      environmentId !== this.config.get('PREVIEW_ENVIRONMENT_ID', { infer: true })
    )
      throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
  }
  inspect(environmentId: string) {
    this.environment(environmentId);
    return this.repository.inspect(environmentId);
  }
  completeRoles(environmentId: string, now = new Date()) {
    this.environment(environmentId);
    return this.repository.completeRoles(environmentId, now);
  }
  async initialize(
    environmentId: string,
    input: PreviewAccountInput[],
    dryRun = false,
    now = new Date(),
    existingAdmin = false,
  ) {
    this.environment(environmentId);
    if (
      input.length !== 5 ||
      new Set(input.map((a) => a.slot)).size !== 5 ||
      input.some((a) => !PREVIEW_SLOTS.includes(a.slot))
    )
      throw new EmailAuthError('EMAIL_COMMAND_CONFLICT');
    const normalized = input.map((account) => {
      assertNewPassword(account.password);
      const profile = account.profile
        ? this.profiles.validateAdult(account.profile, now)
        : undefined;
      if (account.slot.startsWith('MOBILE_') && !profile)
        throw new EmailAuthError('EMAIL_COMMAND_CONFLICT');
      return {
        slot: account.slot,
        username: normalizeUsername(account.username),
        password: account.password,
        profile,
      };
    });
    if (
      new Set(normalized.map((a) => a.username)).size !== 5 ||
      new Set(normalized.map((a) => a.password)).size !== 5
    )
      throw new EmailAuthError('EMAIL_COMMAND_CONFLICT');
    const accounts = await Promise.all(
      normalized.map(async ({ password, profile, ...account }) => ({
        ...account,
        ...(profile ? { profile } : {}),
        passwordHash: await this.hasher.hash(password),
      })),
    );
    return this.repository.initialize(environmentId, accounts, dryRun, now, existingAdmin);
  }
}
