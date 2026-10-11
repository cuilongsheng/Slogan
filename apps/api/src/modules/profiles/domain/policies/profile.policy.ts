import {
  CEFR_LEVELS,
  GENDER_CODES,
  type OnboardingState,
  type ProfileData,
  type ProfileRecord,
} from '../entities/profile.js';

export class ProfileValidationError extends Error {
  readonly code = 'PROFILE_INVALID';

  constructor(public readonly violations: string[]) {
    super('Profile validation failed');
  }
}

const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export class ProfilePolicy {
  validate(input: ProfileData, now: Date): ProfileData {
    const violations: string[] = [];
    const displayName = input.displayName.trim();
    const city = input.city?.trim() || undefined;
    const nationalityCode = input.nationalityCode?.trim().toUpperCase() || undefined;
    const interestCodes = input.interestCodes.map((code) => code.trim().toLowerCase());

    try {
      const url = new URL(input.avatarUrl);
      if (!['http:', 'https:'].includes(url.protocol) || input.avatarUrl.length > 2048) {
        violations.push('avatarUrl');
      }
    } catch {
      violations.push('avatarUrl');
    }

    if (displayName.length < 2 || displayName.length > 40) violations.push('displayName');
    if (input.genderCode != null && !GENDER_CODES.includes(input.genderCode))
      violations.push('genderCode');
    if (nationalityCode !== undefined && !/^[A-Z]{2}$/.test(nationalityCode)) {
      violations.push('nationalityCode');
    }
    if (city !== undefined && city.length > 100) violations.push('city');
    if (
      interestCodes.length < 1 ||
      interestCodes.length > 10 ||
      new Set(interestCodes).size !== interestCodes.length ||
      interestCodes.some((code) => !CODE_PATTERN.test(code))
    ) {
      violations.push('interestCodes');
    }
    if (!CEFR_LEVELS.includes(input.cefrLevel)) violations.push('cefrLevel');
    const year = input.birthYear ?? undefined;
    const month = input.birthMonth ?? undefined;
    const currentYear = now.getUTCFullYear();
    if (year !== undefined || month !== undefined) {
      if (month === undefined || !Number.isInteger(month) || month < 1 || month > 12)
        violations.push('birthMonth');
      if (
        year === undefined ||
        !Number.isInteger(year) ||
        year < Math.max(1900, currentYear - 120) ||
        year > currentYear
      )
        violations.push('birthYear');
      if (year === currentYear && month !== undefined && month > now.getUTCMonth() + 1)
        violations.push('birthMonth');
    }

    if (violations.length > 0) throw new ProfileValidationError([...new Set(violations)]);

    return {
      avatarUrl: input.avatarUrl,
      displayName,
      ...(input.genderCode == null ? {} : { genderCode: input.genderCode }),
      ...(nationalityCode === undefined ? {} : { nationalityCode }),
      ...(city === undefined ? {} : { city }),
      interestCodes,
      cefrLevel: input.cefrLevel,
      ...(year === undefined ? {} : { birthYear: year }),
      ...(month === undefined ? {} : { birthMonth: month }),
    };
  }

  onboardingState(profile: ProfileRecord | null, now: Date): OnboardingState {
    if (profile === null) return 'PROFILE_REQUIRED';
    return isAdultProfile(profile, now) ? 'ELIGIBLE' : 'AGE_RESTRICTED';
  }
}

/** A recorded birth date overrides self-declaration; retain the conservative month boundary. */
export function isAdultProfile(
  profile: {
    birthYear?: number | null;
    birthMonth?: number | null;
    adultConfirmedAt?: Date | null;
  } | null,
  now: Date,
): boolean {
  if (!profile) return false;
  if (profile.birthYear != null || profile.birthMonth != null) {
    if (profile.birthYear == null || profile.birthMonth == null) return false;
    return now.getTime() >= Date.UTC(profile.birthYear + 18, profile.birthMonth, 1);
  }
  return profile.adultConfirmedAt != null && profile.adultConfirmedAt.getTime() <= now.getTime();
}
