import {
  type ProfileData,
  type ProfileRecord,
  ProfilePolicy,
  ProfileValidationError,
} from '../../src/modules/profiles/index.js';

const now = new Date('2026-09-10T00:00:00.000Z');
const validProfile: ProfileData = {
  avatarUrl: 'https://example.com/avatar.png',
  displayName: 'Ada',
  genderCode: 'prefer_not_to_say',
  nationalityCode: 'cn',
  interestCodes: ['distributed-systems', 'remote_work'],
  cefrLevel: 'B1',
  birthYear: 2000,
  birthMonth: 2,
};

describe('ProfilePolicy', () => {
  const policy = new ProfilePolicy();

  it('normalizes a complete profile', () => {
    expect(policy.validate(validProfile, now)).toEqual({
      ...validProfile,
      nationalityCode: 'CN',
    });
  });

  it.each(['A1_A2', 'B1_B2', 'C1_C2'] as const)('accepts profile CEFR band %s', (cefrLevel) => {
    expect(policy.validate({ ...validProfile, cefrLevel }, now).cefrLevel).toBe(cefrLevel);
  });

  it.each([
    ['avatarUrl', { avatarUrl: 'file:///tmp/avatar' }],
    ['displayName', { displayName: 'x' }],
    ['genderCode', { genderCode: 'unknown' }],
    ['nationalityOrCity', { nationalityCode: undefined, city: undefined }],
    ['interestCodes', { interestCodes: ['same', 'same'] }],
    ['cefrLevel', { cefrLevel: 'B9' }],
    ['birthMonth', { birthMonth: 13 }],
    ['birthYear', { birthYear: 2100 }],
  ])('rejects invalid %s', (field, patch) => {
    expect(() => policy.validate({ ...validProfile, ...patch } as ProfileData, now)).toThrow(
      ProfileValidationError,
    );
    try {
      policy.validate({ ...validProfile, ...patch } as ProfileData, now);
    } catch (error) {
      expect((error as ProfileValidationError).violations).toContain(field);
    }
  });

  it('requires a completed profile before room eligibility', () => {
    expect(policy.onboardingState(null, now)).toBe('PROFILE_REQUIRED');
  });

  it('keeps a user age-restricted through their eighteenth birth month', () => {
    const profile = {
      ...validProfile,
      userId: 'user-id',
      birthYear: 2008,
      birthMonth: 9,
      completedAt: now,
    } satisfies ProfileRecord;
    expect(policy.onboardingState(profile, new Date('2026-09-30T23:59:59.999Z'))).toBe(
      'AGE_RESTRICTED',
    );
    expect(policy.onboardingState(profile, new Date('2026-10-01T00:00:00.000Z'))).toBe('ELIGIBLE');
  });

  it('handles year and leap-year month boundaries in UTC', () => {
    const december = {
      ...validProfile,
      userId: 'user-id',
      birthYear: 2007,
      birthMonth: 12,
      completedAt: now,
    } satisfies ProfileRecord;
    const february = { ...december, birthYear: 2008, birthMonth: 2 };
    expect(policy.onboardingState(december, new Date('2026-01-01T00:00:00.000Z'))).toBe('ELIGIBLE');
    expect(policy.onboardingState(february, new Date('2026-03-01T00:00:00.000Z'))).toBe('ELIGIBLE');
  });
});
