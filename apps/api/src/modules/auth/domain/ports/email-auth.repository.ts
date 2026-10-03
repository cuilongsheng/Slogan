export const EMAIL_AUTH_REPOSITORY = Symbol('EMAIL_AUTH_REPOSITORY');
export interface EmailCredentialView {
  userId: string;
  username: string;
  email: string;
  passwordHash: string | null;
  credentialVersion: number;
  active: boolean;
}
export interface EmailEnrollmentView {
  id: string;
  purpose: 'REGISTER' | 'LINK';
  username: string | null;
  email: string | null;
  passwordHash: string | null;
  generation: number;
  expiresAt: Date;
  lastSentAt: Date;
  completedAt: Date | null;
  userId: string | null;
  sessionId: string | null;
}
export interface EmailChallengeInput {
  id: string;
  tokenDigest: string;
  deliveryId: string;
  encryptedPayload: string;
  keyId: string;
}
export interface EnrollmentInput {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  managementDigest: string;
  now: Date;
  challenge: EmailChallengeInput;
  link?: {
    userId: string;
    sessionId: string;
    commandId: string;
    payloadHash: string;
    proofDigests: string[];
  };
}
export interface EmailAuthRepository {
  enroll(input: EnrollmentInput): Promise<EmailEnrollmentView>;
  findEnrollment(digests: string[], now: Date): Promise<EmailEnrollmentView | null>;
  resend(id: string, challenge: EmailChallengeInput, now: Date): Promise<void>;
  confirm(
    digests: string[],
    purpose: 'REGISTER' | 'LINK',
    now: Date,
    identity?: { userId: string; sessionId: string },
  ): Promise<void>;
  credential(username: string): Promise<EmailCredentialView | null>;
  pending(username: string, now: Date): Promise<string[]>;
  credentialForUser(userId: string): Promise<EmailCredentialView | null>;
  requestReset(email: string, challenge: EmailChallengeInput, now: Date): Promise<void>;
  reset(digests: string[], passwordHash: string, now: Date): Promise<void>;
  createProof(input: {
    id: string;
    userId: string;
    sessionId: string;
    commandId: string;
    purpose: 'LINK_EMAIL' | 'ACCOUNT_DELETE';
    tokenDigest: string;
    credentialVersion?: number;
    now: Date;
  }): Promise<void>;
}
