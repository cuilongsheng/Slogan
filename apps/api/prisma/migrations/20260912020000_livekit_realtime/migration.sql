-- CreateEnum
CREATE TYPE "RealtimePresence" AS ENUM ('DISCONNECTED', 'CONNECTED');

-- CreateEnum
CREATE TYPE "RealtimeCommandType" AS ENUM ('REVOKE_IDENTITY', 'DELETE_ROOM');

-- CreateEnum
CREATE TYPE "RealtimeCommandStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "RoomStatus" ADD VALUE 'ENDING';

-- AlterTable
ALTER TABLE "RoomMembership" ADD COLUMN     "credentialVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "participantIdentity" UUID,
ADD COLUMN     "presence" "RealtimePresence" NOT NULL DEFAULT 'DISCONNECTED',
ADD COLUMN     "presenceUpdatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "providerSessionSid" TEXT;

-- Backfill existing memberships before enforcing the required identity.
UPDATE "RoomMembership" SET "participantIdentity" = gen_random_uuid() WHERE "participantIdentity" IS NULL;
ALTER TABLE "RoomMembership" ALTER COLUMN "participantIdentity" SET NOT NULL;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "endedAt" TIMESTAMPTZ(3),
ADD COLUMN     "endedReason" VARCHAR(64),
ADD COLUMN     "providerRoomSid" TEXT,
ADD COLUMN     "stateVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RealtimeCommand" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "roomId" UUID NOT NULL,
    "type" "RealtimeCommandType" NOT NULL,
    "identity" UUID,
    "stateVersion" INTEGER NOT NULL,
    "status" "RealtimeCommandStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMPTZ(3),
    "leaseId" UUID,
    "lastError" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RealtimeCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealtimeIdentity" (
    "identity" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "issueUntil" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RealtimeIdentity_pkey" PRIMARY KEY ("identity")
);

-- CreateTable
CREATE TABLE "RoomEvent" (
    "id" UUID NOT NULL,
    "providerEventId" TEXT,
    "roomId" UUID,
    "type" VARCHAR(64) NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "actorId" UUID,
    "targetId" UUID,
    "reason" VARCHAR(64),
    "result" VARCHAR(32) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RealtimeCommand_key_key" ON "RealtimeCommand"("key");

-- CreateIndex
CREATE INDEX "RealtimeCommand_status_nextAttemptAt_idx" ON "RealtimeCommand"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "RealtimeCommand_roomId_type_status_idx" ON "RealtimeCommand"("roomId", "type", "status");

-- CreateIndex
CREATE INDEX "RealtimeIdentity_roomId_revokedAt_idx" ON "RealtimeIdentity"("roomId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomEvent_providerEventId_key" ON "RoomEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "RoomEvent_roomId_occurredAt_idx" ON "RoomEvent"("roomId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMembership_participantIdentity_key" ON "RoomMembership"("participantIdentity");

-- AddForeignKey
ALTER TABLE "RealtimeCommand" ADD CONSTRAINT "RealtimeCommand_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtimeIdentity" ADD CONSTRAINT "RealtimeIdentity_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtimeIdentity" ADD CONSTRAINT "RealtimeIdentity_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "RoomMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomEvent" ADD CONSTRAINT "RoomEvent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

