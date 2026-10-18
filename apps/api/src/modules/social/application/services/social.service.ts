import { SocialError } from '../../domain/errors/social.error.js';
import { Inject, Injectable } from '@nestjs/common';

import type { FriendRequestAction } from '../../domain/entities/social.js';
import { SOCIAL_PRESENCE, type SocialPresence } from '../../domain/ports/presence.port.js';
import { SOCIAL_REPOSITORY, type SocialRepository } from '../../domain/ports/social.repository.js';
import { decodeSocialCursor, encodeSocialCursor } from '../social-cursor.js';

@Injectable()
export class SocialService {
  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly social: SocialRepository,
    @Inject(SOCIAL_PRESENCE) private readonly presence: SocialPresence,
  ) {}

  async createFriendRequest(
    actorUserId: string,
    input: { targetUserId: string; clientRequestId: string },
    now = new Date(),
  ) {
    return this.social.createFriendRequest({ actorUserId, ...input, now });
  }

  async resolveFriendRequest(
    actorUserId: string,
    requestId: string,
    action: FriendRequestAction,
    clientRequestId: string,
    now = new Date(),
  ) {
    return this.social.resolveFriendRequest({
      actorUserId,
      requestId,
      action,
      clientRequestId,
      now,
    });
  }

  async listFriendRequests(
    userId: string,
    query: { direction: 'incoming' | 'outgoing'; cursor?: string; limit?: number },
    now = new Date(),
  ) {
    await this.social.assertActorEligible(userId, now);
    const kind = `friend-requests:${query.direction}`;
    const page = await this.social.listFriendRequests({
      userId,
      direction: query.direction,
      cursor: decodeSocialCursor(kind, query.cursor),
      limit: query.limit ?? 20,
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor ? encodeSocialCursor(kind, page.nextCursor) : null,
    };
  }

  async listFriends(userId: string, query: { cursor?: string; limit?: number }, now = new Date()) {
    await this.social.assertActorEligible(userId, now);
    const page = await this.social.listFriends({
      userId,
      cursor: decodeSocialCursor('friends', query.cursor),
      limit: query.limit ?? 20,
    });
    const online = await this.presence.online(page.items.map((item) => item.friend.userId));
    const available = new Set(
      (
        await Promise.all(
          page.items.map(async (item) => ({
            userId: item.friend.userId,
            available:
              online.has(item.friend.userId) &&
              (await this.social.isTargetEligible(item.friend.userId, now)) &&
              (await this.social.isTargetOutsideRooms(item.friend.userId)),
          })),
        )
      )
        .filter((item) => item.available)
        .map((item) => item.userId),
    );
    return {
      items: page.items.map((item) => ({
        ...item,
        isAvailable: available.has(item.friend.userId),
      })),
      nextCursor: page.nextCursor ? encodeSocialCursor('friends', page.nextCursor) : null,
    };
  }

  async deleteFriend(
    actorUserId: string,
    friendUserId: string,
    clientRequestId: string,
    now = new Date(),
  ) {
    return this.social.deleteFriend({ actorUserId, friendUserId, clientRequestId, now });
  }

  async createBlock(
    actorUserId: string,
    input: { targetUserId: string; clientRequestId: string },
    now = new Date(),
  ) {
    return this.social.createBlock({ actorUserId, ...input, now });
  }

  async deleteBlock(
    actorUserId: string,
    targetUserId: string,
    clientRequestId: string,
    now = new Date(),
  ) {
    return this.social.deleteBlock({ actorUserId, targetUserId, clientRequestId, now });
  }

  async listBlocks(userId: string, query: { cursor?: string; limit?: number }, now = new Date()) {
    await this.social.assertActorEligible(userId, now);
    const page = await this.social.listBlocks({
      userId,
      cursor: decodeSocialCursor('blocks', query.cursor),
      limit: query.limit ?? 20,
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor ? encodeSocialCursor('blocks', page.nextCursor) : null,
    };
  }

  async heartbeat(userId: string, now = new Date(), verifiedEligible?: boolean) {
    if (verifiedEligible === false)
      throw new SocialError('SOCIAL_ACCESS_RESTRICTED', 'Social access is restricted');
    if (verifiedEligible === undefined) await this.social.assertActorEligible(userId, now);
    return this.presence.refresh(userId);
  }

  async assertEligible(userId: string, now = new Date()): Promise<void> {
    await this.social.assertActorEligible(userId, now);
  }

  async listAvailable(
    userId: string,
    query: { cursor?: string; limit?: number },
    now = new Date(),
  ) {
    await this.social.assertActorEligible(userId, now);
    // An eligible foreground list request is itself authenticated online activity.
    // Refresh only this actor; never infer presence for returned candidates.
    await this.presence.refresh(userId);
    const limit = query.limit ?? 20;
    let cursor = decodeSocialCursor('available', query.cursor);
    const items: Array<
      Omit<
        Awaited<ReturnType<SocialRepository['listAvailableCandidates']>>['items'][number],
        'createdAt'
      > & { isAvailable: true }
    > = [];
    // Candidate scans are bounded. Continue past offline pages; never skip online
    // candidates after the returned limit within a larger scanned page.
    for (let scan = 0; scan < 5; scan++) {
      const page = await this.social.listAvailableCandidates({ userId, cursor, limit, now });
      const online = await this.presence.online(page.items.map((item) => item.userId));
      for (const [index, item] of page.items.entries()) {
        if (!online.has(item.userId)) continue;
        const { createdAt, ...profile } = item;
        items.push({ ...profile, isAvailable: true });
        if (items.length === limit)
          return {
            items,
            nextCursor:
              index < page.items.length - 1 || page.nextCursor
                ? encodeSocialCursor('available', { createdAt, id: item.userId })
                : null,
          };
      }
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    return { items, nextCursor: cursor ? encodeSocialCursor('available', cursor) : null };
  }

  async canInvite(actorUserId: string, targetUserId: string, now = new Date()): Promise<boolean> {
    if (
      !(await this.social.isTargetEligible(actorUserId, now)) ||
      !(await this.social.isTargetEligible(targetUserId, now)) ||
      (await this.social.isPairBlocked(actorUserId, targetUserId)) ||
      !(await this.social.isTargetOutsideRooms(targetUserId))
    )
      return false;
    if (await this.social.isFriend(actorUserId, targetUserId)) return true;
    return (await this.presence.online([targetUserId])).has(targetUserId);
  }
}
