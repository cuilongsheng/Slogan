import { Inject, Injectable } from '@nestjs/common';

import type { OnboardingState, ProfileData, ProfileRecord } from '../../domain/entities/profile.js';
import { ProfilePolicy } from '../../domain/policies/profile.policy.js';
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
  async put(userId: string, input: ProfileData, now = new Date()): Promise<ProfileRecord> {
    const profile = this.policy.validate(input, now);
    return this.profiles.upsert(userId, profile, now);
  }
}
