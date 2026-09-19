CREATE TABLE "RoomNote" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "content" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RoomNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoomNote_version_check" CHECK ("version" > 0),
  CONSTRAINT "RoomNote_content_length_check" CHECK (
    "content" IS NULL OR char_length("content") <= 2000
  ),
  CONSTRAINT "RoomNote_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RoomNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RoomNote_roomId_userId_key" ON "RoomNote"("roomId", "userId");
CREATE INDEX "RoomNote_userId_updatedAt_idx" ON "RoomNote"("userId", "updatedAt");
