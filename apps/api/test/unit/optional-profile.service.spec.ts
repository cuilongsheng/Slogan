import { fn } from 'jest-mock';
import {
  ProfilesService,
  ProfilePolicy,
  ProfileValidationError,
  type ProfileRecord,
  type ProfileData,
} from '../../src/modules/profiles/index.js';
const now = new Date('2026-10-11T00:00:00Z');
const input: ProfileData = {
  avatarUrl: 'https://example.test/avatar.png',
  displayName: 'Ada',
  interestCodes: ['travel'],
  cefrLevel: 'B1',
};
function service(existing: ProfileRecord | null = null) {
  const upsert = fn(async (userId: string, profile: ProfileData, completedAt: Date) => ({
    ...profile,
    userId,
    completedAt,
  }));
  return {
    upsert,
    profiles: new ProfilesService(
      { findByUserId: async () => existing, upsert },
      new ProfilePolicy(),
    ),
  };
}
describe('optional profile completion', () => {
  it('requires a deliberate first confirmation and owns its timestamp', async () => {
    const { profiles, upsert } = service();
    await expect(profiles.put('user', input, now)).rejects.toBeInstanceOf(ProfileValidationError);
    expect(upsert).not.toHaveBeenCalled();
    await expect(
      profiles.put(
        'user',
        { ...input, adultConfirmed: true, adultConfirmedAt: new Date('2000-01-01') },
        now,
      ),
    ).resolves.toMatchObject({ adultConfirmedAt: now });
  });
  it('allows legacy adult updates without creating confirmation history', async () => {
    const { profiles } = service({
      ...input,
      userId: 'user',
      completedAt: now,
      birthYear: 2000,
      birthMonth: 1,
    });
    const result = await profiles.put('user', { ...input, birthYear: 2000, birthMonth: 1 }, now);
    expect(result.adultConfirmedAt).toBeUndefined();
  });
  it('cannot erase or replace a recorded underage date', async () => {
    const { profiles, upsert } = service({
      ...input,
      userId: 'user',
      completedAt: now,
      birthYear: 2015,
      birthMonth: 1,
    });
    await expect(
      profiles.put('user', { ...input, adultConfirmed: true }, now),
    ).rejects.toBeInstanceOf(ProfileValidationError);
    await expect(
      profiles.put('user', { ...input, adultConfirmed: true, birthYear: 2000, birthMonth: 1 }, now),
    ).rejects.toBeInstanceOf(ProfileValidationError);
    expect(upsert).not.toHaveBeenCalled();
  });
});
