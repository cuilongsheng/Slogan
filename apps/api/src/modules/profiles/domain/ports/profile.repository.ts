import type { ProfileData, ProfileRecord } from '../entities/profile.js';

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export interface ProfileRepository {
  findByUserId(userId: string): Promise<ProfileRecord | null>;
  upsert(userId: string, profile: ProfileData, completedAt: Date): Promise<ProfileRecord>;
}
