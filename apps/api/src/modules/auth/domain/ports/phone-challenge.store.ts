import type {
  PhoneChallengePurpose,
  PhoneChallengeView,
  PhoneFingerprint,
  VerificationGrant,
} from '../entities/phone-auth.js';

export const PHONE_CHALLENGE_STORE = Symbol('PHONE_CHALLENGE_STORE');

export interface PhoneChallengeStore {
  issue(input: {
    purpose: PhoneChallengePurpose;
    phone: PhoneFingerprint;
    userId?: string;
    source: string;
    deviceId: string;
    codeDigest: string;
    now: Date;
  }): Promise<PhoneChallengeView>;
  abandon(challengeId: string): Promise<void>;
  verify(input: {
    challengeId: string;
    purpose: PhoneChallengePurpose;
    userId?: string;
    clientRequestId: string;
    codeDigest: string;
    now: Date;
  }): Promise<VerificationGrant>;
  createProof(input: {
    purpose: 'ACCOUNT_DELETE';
    userId: string;
    clientRequestId: string;
    phone?: PhoneFingerprint;
    now: Date;
  }): Promise<VerificationGrant>;
  readGrant(input: {
    grantId: string;
    purpose: PhoneChallengePurpose;
    userId?: string;
    clientRequestId: string;
  }): Promise<VerificationGrant>;
  completeGrant(grantId: string, clientRequestId: string): Promise<void>;
  cleanup(): Promise<number>;
}
