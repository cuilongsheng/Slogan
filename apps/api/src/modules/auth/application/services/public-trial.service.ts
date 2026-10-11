import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import {
  PUBLIC_TRIAL_REPOSITORY,
  type PublicTrialRepository,
} from '../../domain/ports/public-trial.repository.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/ports/password-hasher.port.js';
@Injectable()
export class PublicTrialService {
  constructor(
    @Inject(PUBLIC_TRIAL_REPOSITORY) private readonly repository: PublicTrialRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  private target(environmentId: string) {
    if (
      !environmentId ||
      environmentId !== this.config.get('PREVIEW_ENVIRONMENT_ID', { infer: true }) ||
      !this.config.get('PREVIEW_ACCOUNTS_ENABLED', { infer: true }) ||
      !this.config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true })
    )
      throw new Error('PUBLIC_TRIAL_TARGET_INVALID');
  }
  inspect(environmentId: string) {
    this.target(environmentId);
    return this.repository.inspect(environmentId);
  }
  async provision(environmentId: string, password: string, dryRun: boolean, now = new Date()) {
    this.target(environmentId);
    // Owner-approved public credential exception. Normal password policy is unchanged.
    if (password !== '12345678') throw new Error('PUBLIC_TRIAL_INPUT_INVALID');
    return this.repository.provision(
      environmentId,
      dryRun ? null : await this.hasher.hash(password),
      now,
    );
  }
  disable(environmentId: string, now = new Date()) {
    this.target(environmentId);
    return this.repository.disable(environmentId, now);
  }
}
