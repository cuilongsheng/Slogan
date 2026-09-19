CREATE TYPE "MembershipLifecycle" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED', 'INVITED');
ALTER TYPE "RealtimeCommandType" ADD VALUE 'HOST_TIMEOUT';
ALTER TABLE "RoomMembership"
 ADD COLUMN "lifecycle" "MembershipLifecycle" NOT NULL DEFAULT 'ACTIVE',
 ADD COLUMN "leftAt" TIMESTAMPTZ(3),
 ADD COLUMN "removedAt" TIMESTAMPTZ(3),
 ADD COLUMN "removalReason" VARCHAR(64);
ALTER TABLE "Room"
 ADD COLUMN "hostDisconnectedAt" TIMESTAMPTZ(3),
 ADD COLUMN "hostReconnectDeadline" TIMESTAMPTZ(3),
 ADD COLUMN "hostReconnectVersion" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "RoomMembership_roomId_lifecycle_idx" ON "RoomMembership"("roomId", "lifecycle");
