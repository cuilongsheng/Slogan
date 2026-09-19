export const PHONE_CHALLENGE_PURPOSES = ['LOGIN', 'LINK', 'ACCOUNT_DELETE'] as const;
export type PhoneChallengePurpose = (typeof PHONE_CHALLENGE_PURPOSES)[number];

export interface PhoneFingerprint {
  lookupVersion: string;
  lookupHash: string;
  countryCallingCode: string;
  lastTwo: string;
  region: string;
}

export interface NormalizedPhone extends PhoneFingerprint {
  e164: string;
}

export interface PhoneChallengeView {
  challengeId: string;
  expiresAt: Date;
  resendAt: Date;
}

export interface VerificationGrant {
  grantId: string;
  purpose: PhoneChallengePurpose;
  userId?: string;
  clientRequestId: string;
  phone: PhoneFingerprint;
}

export interface LoginMethodView {
  type: 'PHONE' | 'GOOGLE' | 'WECHAT';
  verifiedAt: Date;
  mask?: string;
}
