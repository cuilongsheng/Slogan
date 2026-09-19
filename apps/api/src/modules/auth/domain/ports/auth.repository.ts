import type { OAuthProviderName, ProviderIdentity } from '../entities/provider-identity.js';
import type { LoginMethodView, PhoneFingerprint } from '../entities/phone-auth.js';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export type RotateRefreshResult =
  | { status: 'ROTATED'; userId: string; sessionId: string; expiresAt: Date }
  | { status: 'INVALID' }
  | { status: 'REUSED' };

export interface AuthRepository {
  findOrCreateUser(
    identity: ProviderIdentity,
    now: Date,
  ): Promise<{ userId: string; created: boolean }>;
  createSession(input: {
    userId: string;
    deviceName?: string;
    digest: string;
    expiresAt: Date;
    now: Date;
  }): Promise<{ sessionId: string }>;
  rotateRefreshToken(input: {
    digest: string;
    nextDigest: string;
    nextExpiresAt: Date;
    now: Date;
  }): Promise<RotateRefreshResult>;
  revokeSession(userId: string, sessionId: string, now: Date): Promise<void>;
  isSessionActive(userId: string, sessionId: string, now: Date): Promise<boolean>;
  findProviderForUser(userId: string): Promise<OAuthProviderName | null>;
  findOrCreatePhoneUser(
    phone: PhoneFingerprint,
    now: Date,
  ): Promise<{ userId: string; created: boolean }>;
  linkPhoneIdentity(
    userId: string,
    phone: PhoneFingerprint,
    now: Date,
  ): Promise<'CREATED' | 'ALREADY_LINKED'>;
  linkOAuthIdentity(
    userId: string,
    identity: ProviderIdentity,
    now: Date,
  ): Promise<'CREATED' | 'ALREADY_LINKED'>;
  listLoginMethods(userId: string): Promise<LoginMethodView[]>;
  ownsOAuthIdentity(userId: string, identity: ProviderIdentity): Promise<boolean>;
  ownsPhoneIdentity(userId: string, phone: PhoneFingerprint): Promise<boolean>;
  assertActive(userId: string): Promise<void>;
}
