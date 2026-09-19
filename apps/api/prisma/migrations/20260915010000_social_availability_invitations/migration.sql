CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'BLOCKED');
CREATE TYPE "SocialCommandType" AS ENUM ('FRIEND_REQUEST_CREATE', 'FRIEND_REQUEST_ACCEPT', 'FRIEND_REQUEST_REJECT', 'FRIEND_REQUEST_WITHDRAW', 'FRIEND_DELETE', 'BLOCK_CREATE', 'BLOCK_DELETE', 'ROOM_INVITATION_CREATE', 'ROOM_INVITATION_DECLINE');
CREATE TYPE "RoomInvitationStatus" AS ENUM ('PENDING', 'DECLINED', 'CONSUMED', 'CANCELLED');

CREATE TABLE "FriendRequest" (
  "id" UUID NOT NULL,
  "requesterUserId" UUID NOT NULL,
  "recipientUserId" UUID NOT NULL,
  "userLowId" UUID NOT NULL,
  "userHighId" UUID NOT NULL,
  "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
  "resolvedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FriendRequest_distinct_users_check" CHECK ("requesterUserId" <> "recipientUserId" AND "userLowId" < "userHighId"),
  CONSTRAINT "FriendRequest_sender_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FriendRequest_recipient_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FriendRequest_active_pair_key" ON "FriendRequest"("userLowId", "userHighId") WHERE "status" = 'PENDING';
CREATE INDEX "FriendRequest_recipient_status_created_id_idx" ON "FriendRequest"("recipientUserId", "status", "createdAt", "id");
CREATE INDEX "FriendRequest_requester_status_created_id_idx" ON "FriendRequest"("requesterUserId", "status", "createdAt", "id");
CREATE INDEX "FriendRequest_pair_status_idx" ON "FriendRequest"("userLowId", "userHighId", "status");

CREATE TABLE "Friendship" (
  "id" UUID NOT NULL,
  "userLowId" UUID NOT NULL,
  "userHighId" UUID NOT NULL,
  "endedAt" TIMESTAMPTZ(3),
  "endedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Friendship_pair_check" CHECK ("userLowId" < "userHighId"),
  CONSTRAINT "Friendship_low_fkey" FOREIGN KEY ("userLowId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Friendship_high_fkey" FOREIGN KEY ("userHighId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Friendship_ended_by_fkey" FOREIGN KEY ("endedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Friendship_userLowId_userHighId_key" ON "Friendship"("userLowId", "userHighId");
CREATE INDEX "Friendship_low_active_created_id_idx" ON "Friendship"("userLowId", "endedAt", "createdAt", "id");
CREATE INDEX "Friendship_high_active_created_id_idx" ON "Friendship"("userHighId", "endedAt", "createdAt", "id");

CREATE TABLE "UserBlock" (
  "id" UUID NOT NULL,
  "blockerUserId" UUID NOT NULL,
  "blockedUserId" UUID NOT NULL,
  "unblockedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserBlock_distinct_users_check" CHECK ("blockerUserId" <> "blockedUserId"),
  CONSTRAINT "UserBlock_blocker_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "UserBlock_blocked_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserBlock_blockerUserId_blockedUserId_key" ON "UserBlock"("blockerUserId", "blockedUserId");
CREATE INDEX "UserBlock_blocker_active_created_id_idx" ON "UserBlock"("blockerUserId", "unblockedAt", "createdAt", "id");
CREATE INDEX "UserBlock_blocked_active_idx" ON "UserBlock"("blockedUserId", "unblockedAt");

CREATE TABLE "SocialCommand" (
  "id" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "type" "SocialCommandType" NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialCommand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialCommand_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SocialCommand_actorUserId_clientRequestId_key" ON "SocialCommand"("actorUserId", "clientRequestId");
CREATE INDEX "SocialCommand_createdAt_idx" ON "SocialCommand"("createdAt");

CREATE TABLE "RoomInvitation" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "inviterUserId" UUID NOT NULL,
  "inviteeUserId" UUID NOT NULL,
  "status" "RoomInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "resolvedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoomInvitation_distinct_users_check" CHECK ("inviterUserId" <> "inviteeUserId"),
  CONSTRAINT "RoomInvitation_room_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RoomInvitation_inviter_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RoomInvitation_invitee_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RoomInvitation_active_room_target_key" ON "RoomInvitation"("roomId", "inviteeUserId") WHERE "status" = 'PENDING';
CREATE INDEX "RoomInvitation_invitee_status_created_id_idx" ON "RoomInvitation"("inviteeUserId", "status", "createdAt", "id");
CREATE INDEX "RoomInvitation_room_status_idx" ON "RoomInvitation"("roomId", "status");
CREATE INDEX "RoomInvitation_pair_status_idx" ON "RoomInvitation"("inviterUserId", "inviteeUserId", "status");
