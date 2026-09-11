-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('OPEN', 'ENDED');

-- CreateEnum
CREATE TYPE "RoomMembershipRole" AS ENUM ('HOST', 'MEMBER');

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "hostUserId" UUID NOT NULL,
    "topic" VARCHAR(120) NOT NULL,
    "cefrLevel" "CefrLevel" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "passwordDigest" CHAR(64),
    "status" "RoomStatus" NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Room_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Room_capacity_check" CHECK ("capacity" BETWEEN 2 AND 6),
    CONSTRAINT "Room_ends_after_start_check" CHECK ("endsAt" > "startedAt"),
    CONSTRAINT "Room_password_digest_check" CHECK ("passwordDigest" IS NULL OR length("passwordDigest") = 64)
);

-- CreateTable
CREATE TABLE "RoomMembership" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "RoomMembershipRole" NOT NULL,
    "joinOrder" INTEGER NOT NULL,
    "rulesVersion" VARCHAR(64) NOT NULL,
    "rulesAcceptedAt" TIMESTAMPTZ(3) NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomMembership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RoomMembership_join_order_check" CHECK ("joinOrder" > 0)
);

-- CreateIndex
CREATE INDEX "Room_status_startedAt_id_idx" ON "Room"("status", "startedAt", "id");
CREATE INDEX "Room_status_endsAt_idx" ON "Room"("status", "endsAt");
CREATE INDEX "Room_hostUserId_idx" ON "Room"("hostUserId");
CREATE UNIQUE INDEX "RoomMembership_roomId_userId_key" ON "RoomMembership"("roomId", "userId");
CREATE UNIQUE INDEX "RoomMembership_roomId_joinOrder_key" ON "RoomMembership"("roomId", "joinOrder");
CREATE INDEX "RoomMembership_userId_idx" ON "RoomMembership"("userId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomMembership" ADD CONSTRAINT "RoomMembership_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMembership" ADD CONSTRAINT "RoomMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
