export const SOCIAL_PRESENCE = Symbol('SOCIAL_PRESENCE');

export interface SocialPresence {
  refresh(userId: string): Promise<{ expiresAt: Date; refreshAfterSeconds: number }>;
  online(userIds: string[]): Promise<Set<string>>;
  clear(userId: string): Promise<void>;
}
