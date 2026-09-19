import { Inject, Injectable } from '@nestjs/common';

import { SocialService } from '../../../social/index.js';
import {
  ROOM_INVITATION_REPOSITORY,
  type RoomInvitationRepository,
} from '../../domain/ports/room-invitation.repository.js';
import {
  decodeSocialCursor,
  encodeSocialCursor,
} from '../../../social/application/social-cursor.js';

@Injectable()
export class RoomInvitationsService {
  constructor(
    @Inject(ROOM_INVITATION_REPOSITORY)
    private readonly invitations: RoomInvitationRepository,
    private readonly social: SocialService,
  ) {}

  async create(
    actorUserId: string,
    roomId: string,
    input: { targetUserId: string; clientRequestId: string },
    now = new Date(),
  ) {
    return this.invitations.create({ actorUserId, roomId, ...input, now });
  }

  async list(userId: string, query: { cursor?: string; limit?: number }, now = new Date()) {
    await this.social.assertEligible(userId, now);
    const page = await this.invitations.list({
      userId,
      cursor: decodeSocialCursor('room-invitations', query.cursor),
      limit: query.limit ?? 20,
      now,
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor ? encodeSocialCursor('room-invitations', page.nextCursor) : null,
    };
  }

  decline(actorUserId: string, invitationId: string, clientRequestId: string, now = new Date()) {
    return this.invitations.decline({ actorUserId, invitationId, clientRequestId, now });
  }
}
