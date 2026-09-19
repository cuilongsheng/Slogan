export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'BLOCKED';
export type FriendRequestAction = 'accept' | 'reject' | 'withdraw';

export interface PublicSocialProfile {
  userId: string;
  displayName: string;
  avatarUrl: string;
  cefrLevel: string;
  nationalityCode: string | null;
  city: string | null;
  interestCodes: string[];
}

export interface FriendRequestRecord {
  id: string;
  requesterUserId: string;
  recipientUserId: string;
  status: FriendRequestStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface FriendshipRecord {
  id: string;
  friend: PublicSocialProfile;
  createdAt: Date;
  isAvailable: boolean;
}

export interface BlockRecord {
  id: string;
  blockedUserId: string;
  createdAt: Date;
}

export interface SocialPage<T> {
  items: T[];
  nextCursor: SocialCursor | null;
}

export interface SocialCursor {
  createdAt: Date;
  id: string;
}
