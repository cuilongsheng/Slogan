export type RoomInvitationStatus = 'PENDING' | 'DECLINED' | 'CONSUMED' | 'CANCELLED';

export interface RoomInvitationRecord {
  id: string;
  roomId: string;
  inviterUserId: string;
  inviteeUserId: string;
  status: RoomInvitationStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface RoomInvitationView extends RoomInvitationRecord {
  room: {
    topic: string;
    cefrLevel: string;
    status: string;
    startedAt: Date;
    endsAt: Date;
    passwordProtected: boolean;
  };
  inviterDisplayName: string;
}
