CREATE TYPE "RoomVisibility" AS ENUM ('PUBLIC', 'LINK_ONLY');

ALTER TYPE "RealtimeCommandType" ADD VALUE 'SYNC_ROOM_TIME';

ALTER TABLE "Room"
  ADD COLUMN "visibility" "RoomVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "shareCode" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "extensionCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Room"
  ADD CONSTRAINT "Room_extensionCount_check" CHECK ("extensionCount" BETWEEN 0 AND 3);

CREATE UNIQUE INDEX "Room_shareCode_key" ON "Room"("shareCode");
CREATE INDEX "Room_kind_visibility_status_startedAt_id_idx"
  ON "Room"("kind", "visibility", "status", "startedAt", "id");

CREATE TABLE "RoomTimeExtension" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "additionalMinutes" INTEGER NOT NULL,
  "previousEndsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "resultingCount" INTEGER NOT NULL,
  "resultingStateVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomTimeExtension_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoomTimeExtension_minutes_check" CHECK ("additionalMinutes" BETWEEN 1 AND 60),
  CONSTRAINT "RoomTimeExtension_count_check" CHECK ("resultingCount" BETWEEN 1 AND 3),
  CONSTRAINT "RoomTimeExtension_version_check" CHECK ("resultingStateVersion" > 0),
  CONSTRAINT "RoomTimeExtension_time_check" CHECK ("endsAt" > "previousEndsAt"),
  CONSTRAINT "RoomTimeExtension_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RoomTimeExtension_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RoomTimeExtension_actorUserId_clientRequestId_key"
  ON "RoomTimeExtension"("actorUserId", "clientRequestId");
CREATE INDEX "RoomTimeExtension_roomId_createdAt_id_idx"
  ON "RoomTimeExtension"("roomId", "createdAt", "id");
