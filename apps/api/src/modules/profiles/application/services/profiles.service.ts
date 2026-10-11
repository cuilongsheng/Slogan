import { Inject, Injectable } from '@nestjs/common';

import type { OnboardingState, ProfileData, ProfileRecord } from '../../domain/entities/profile.js';
import {
  ProfilePolicy,
  ProfileValidationError,
  isAdultProfile,
} from '../../domain/policies/profile.policy.js';
import {
  PROFILE_REPOSITORY,
  type ProfileRepository,
} from '../../domain/ports/profile.repository.js';

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    private readonly policy: ProfilePolicy,
  ) {}

  async get(userId: string): Promise<ProfileRecord | null> {
    return this.profiles.findByUserId(userId);
  }

  async getOnboardingState(userId: string, now = new Date()): Promise<OnboardingState> {
    return this.policy.onboardingState(await this.profiles.findByUserId(userId), now);
  }

  validateAdult(input: ProfileData, now = new Date()): ProfileData {
    const profile = this.policy.validate(input, now);
    if (
      this.policy.onboardingState({ ...profile, userId: '', completedAt: now }, now) !== 'ELIGIBLE'
    )
      throw new Error('PREVIEW_PROFILE_NOT_ADULT');
    return profile;
  }
  async put(
    userId: string,
    input: ProfileData & { adultConfirmed?: boolean },
    now = new Date(),
  ): Promise<ProfileRecord> {
    const profile = this.policy.validate(input, now);
    const existing = await this.profiles.findByUserId(userId);
    if (!existing && input.adultConfirmed !== true)
      throw new ProfileValidationError(['adultConfirmed']);
    if (
      existing?.birthYear != null &&
      !isAdultProfile(existing, now) &&
      (profile.birthYear !== existing.birthYear || profile.birthMonth !== existing.birthMonth)
    )
      throw new ProfileValidationError(['birthYear', 'birthMonth']);
    const adultConfirmedAt =
      existing?.adultConfirmedAt ?? (input.adultConfirmed === true ? now : undefined);
    return this.profiles.upsert(
      userId,
      { ...profile, ...(adultConfirmedAt ? { adultConfirmedAt } : {}) },
      now,
    );
  }
}
