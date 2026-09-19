import type { FriendRequestAction } from '../entities/social.js';
import { SocialError } from '../errors/social.error.js';

export class SocialPolicy {
  pair(left: string, right: string): [string, string] {
    if (left === right)
      throw new SocialError('SOCIAL_TARGET_UNAVAILABLE', 'Social target is unavailable');
    return left < right ? [left, right] : [right, left];
  }

  assertRequestActor(
    action: FriendRequestAction,
    actorUserId: string,
    request: { requesterUserId: string; recipientUserId: string; status: string },
  ): void {
    const allowed =
      action === 'withdraw'
        ? request.requesterUserId === actorUserId
        : request.recipientUserId === actorUserId;
    if (!allowed) throw new SocialError('SOCIAL_REQUEST_NOT_FOUND', 'Friend request was not found');
    if (request.status !== 'PENDING')
      throw new SocialError('SOCIAL_REQUEST_STATE_CONFLICT', 'Friend request is no longer pending');
  }
}
