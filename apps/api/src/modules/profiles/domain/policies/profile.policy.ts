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
    if (!GENDER_CODES.includes(input.genderCode)) violations.push('genderCode');
    if (nationalityCode !== undefined && !/^[A-Z]{2}$/.test(nationalityCode)) {
      violations.push('nationalityCode');
    }
    if (city !== undefined && city.length > 100) violations.push('city');
    if (nationalityCode === undefined && city === undefined) violations.push('nationalityOrCity');
    if (
      interestCodes.length < 1 ||
      interestCodes.length > 10 ||
      new Set(interestCodes).size !== interestCodes.length ||
      interestCodes.some((code) => !CODE_PATTERN.test(code))
    ) {
      violations.push('interestCodes');
    }
    if (!CEFR_LEVELS.includes(input.cefrLevel)) violations.push('cefrLevel');
    if (!Number.isInteger(input.birthMonth) || input.birthMonth < 1 || input.birthMonth > 12) {
      violations.push('birthMonth');
    }
    const currentYear = now.getUTCFullYear();
    if (
      !Number.isInteger(input.birthYear) ||
      input.birthYear < currentYear - 120 ||
      input.birthYear > currentYear
    ) {
      violations.push('birthYear');
    }

    if (violations.length > 0) throw new ProfileValidationError([...new Set(violations)]);

    return {
      avatarUrl: input.avatarUrl,
      displayName,
      genderCode: input.genderCode,
      ...(nationalityCode === undefined ? {} : { nationalityCode }),
      ...(city === undefined ? {} : { city }),
      interestCodes,
      cefrLevel: input.cefrLevel,
      birthYear: input.birthYear,
      birthMonth: input.birthMonth,
    };
  }

  onboardingState(profile: ProfileRecord | null, now: Date): OnboardingState {
    if (profile === null) return 'PROFILE_REQUIRED';
    const eligibleFrom = new Date(Date.UTC(profile.birthYear + 18, profile.birthMonth, 1));
    return now.getTime() >= eligibleFrom.getTime() ? 'ELIGIBLE' : 'AGE_RESTRICTED';
  }
}
