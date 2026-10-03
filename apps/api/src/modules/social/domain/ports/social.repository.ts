import type {
  BlockRecord,
  FriendRequestAction,
  FriendRequestRecord,
  FriendRequestListRecord,
  FriendshipRecord,
  PublicSocialProfile,
  SocialCursor,
  SocialPage,
} from '../entities/social.js';

export const SOCIAL_REPOSITORY = Symbol('SOCIAL_REPOSITORY');

export interface SocialRepository {
  createFriendRequest(input: {
    actorUserId: string;
    targetUserId: string;
    clientRequestId: string;
    now: Date;
  }): Promise<FriendRequestRecord>;
  resolveFriendRequest(input: {
    actorUserId: string;
    requestId: string;
    action: FriendRequestAction;
    clientRequestId: string;
    now: Date;
  }): Promise<FriendRequestRecord>;
  listFriendRequests(input: {
    userId: string;
    direction: 'incoming' | 'outgoing';
    cursor: SocialCursor | null;
    limit: number;
  }): Promise<SocialPage<FriendRequestListRecord>>;
  listFriends(input: {
    userId: string;
    cursor: SocialCursor | null;
    limit: number;
  }): Promise<SocialPage<Omit<FriendshipRecord, 'isAvailable'>>>;
  deleteFriend(input: {
    actorUserId: string;
    friendUserId: string;
    clientRequestId: string;
    now: Date;
  }): Promise<{ friendshipId: string; endedAt: Date }>;
  createBlock(input: {
    actorUserId: string;
    targetUserId: string;
    clientRequestId: string;
    now: Date;
  }): Promise<BlockRecord>;
  deleteBlock(input: {
    actorUserId: string;
    targetUserId: string;
    clientRequestId: string;
    now: Date;
  }): Promise<{ blockId: string; unblockedAt: Date }>;
  listBlocks(input: {
    userId: string;
    cursor: SocialCursor | null;
    limit: number;
  }): Promise<SocialPage<BlockRecord>>;
  listAvailableCandidates(input: {
    userId: string;
    cursor: SocialCursor | null;
    limit: number;
    now: Date;
  }): Promise<SocialPage<PublicSocialProfile & { createdAt: Date }>>;
  assertActorEligible(userId: string, now: Date): Promise<void>;
  isFriend(leftUserId: string, rightUserId: string): Promise<boolean>;
  isPairBlocked(leftUserId: string, rightUserId: string): Promise<boolean>;
  isTargetEligible(userId: string, now: Date): Promise<boolean>;
  isTargetOutsideRooms(userId: string): Promise<boolean>;
}
