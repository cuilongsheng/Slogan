import type { SocialCursor, SocialPage } from '../../../social/domain/entities/social.js';
import type { RoomInvitationRecord, RoomInvitationView } from '../entities/room-invitation.js';

export const ROOM_INVITATION_REPOSITORY = Symbol('ROOM_INVITATION_REPOSITORY');

export interface RoomInvitationRepository {
  create(input: {
    actorUserId: string;
    roomId: string;
    targetUserId: string;
    clientRequestId: string;
    now: Date;
  }): Promise<RoomInvitationRecord>;
  list(input: {
    userId: string;
    cursor: SocialCursor | null;
    limit: number;
    now: Date;
  }): Promise<SocialPage<RoomInvitationView>>;
  decline(input: {
    actorUserId: string;
    invitationId: string;
    clientRequestId: string;
    now: Date;
  }): Promise<RoomInvitationRecord>;
}
