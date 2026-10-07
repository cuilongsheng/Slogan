CREATE TABLE "RoomTextMessage" (
 "id" UUID PRIMARY KEY, "sequence" BIGSERIAL UNIQUE NOT NULL, "roomId" UUID NOT NULL,
 "senderUserId" UUID NOT NULL, "senderDisplayName" VARCHAR(80) NOT NULL,
 "clientRequestId" UUID NOT NULL, "text" VARCHAR(4000) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE,
 FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE,
 UNIQUE ("roomId", "senderUserId", "clientRequestId")
);
CREATE INDEX "RoomTextMessage_roomId_sequence_idx" ON "RoomTextMessage"("roomId", "sequence");
CREATE INDEX "RoomTextMessage_roomId_senderUserId_createdAt_idx" ON "RoomTextMessage"("roomId", "senderUserId", "createdAt");
