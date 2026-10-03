export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'A1_A2', 'B1_B2', 'C1_C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const GENDER_CODES = [
  'female',
  'male',
  'non_binary',
  'self_described',
  'prefer_not_to_say',
] as const;
export type GenderCode = (typeof GENDER_CODES)[number];

export interface ProfileData {
  avatarUrl: string;
  displayName: string;
  genderCode: GenderCode;
  nationalityCode?: string;
  city?: string;
  interestCodes: string[];
  cefrLevel: CefrLevel;
  birthYear: number;
  birthMonth: number;
}

export interface ProfileRecord extends ProfileData {
  userId: string;
  completedAt: Date;
}

export type OnboardingState = 'PROFILE_REQUIRED' | 'AGE_RESTRICTED' | 'ELIGIBLE';
