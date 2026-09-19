ALTER TYPE "SpeechProcessingPurpose" ADD VALUE IF NOT EXISTS 'POST_ROOM_KEYWORDS';

CREATE TYPE "RoomKeywordSummaryStatus" AS ENUM ('COLLECTING', 'PENDING', 'READY', 'UNAVAILABLE');
CREATE TYPE "RoomKeywordItemKind" AS ENUM ('KEYWORD', 'EXPRESSION');
CREATE TYPE "RoomKeywordSummaryJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "VocabularyCommandAction" AS ENUM ('IMPORT');

ALTER TABLE "Room"
  ADD COLUMN "postRoomKeywordsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE FUNCTION "preventPostRoomKeywordsChange"() RETURNS trigger AS $$
BEGIN
  IF NEW."postRoomKeywordsEnabled" IS DISTINCT FROM OLD."postRoomKeywordsEnabled" THEN
    RAISE EXCEPTION 'post room keywords setting is immutable after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Room_postRoomKeywordsEnabled_immutable"
  BEFORE UPDATE OF "postRoomKeywordsEnabled" ON "Room"
  FOR EACH ROW EXECUTE FUNCTION "preventPostRoomKeywordsChange"();

CREATE TABLE "RoomKeywordSummary" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "status" "RoomKeywordSummaryStatus" NOT NULL DEFAULT 'COLLECTING',
  "topicSnapshot" VARCHAR(120) NOT NULL,
  "extractorVersion" VARCHAR(64) NOT NULL,
  "failureCategory" VARCHAR(64),
  "failureObservedAt" TIMESTAMPTZ(3),
  "generatedAt" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RoomKeywordSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomKeywordSummaryItem" (
  "id" UUID NOT NULL,
  "summaryId" UUID NOT NULL,
  "kind" "RoomKeywordItemKind" NOT NULL,
  "displayText" VARCHAR(120) NOT NULL,
  "normalizedText" VARCHAR(120) NOT NULL,
  "rank" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomKeywordSummaryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomKeywordSummaryJob" (
  "id" UUID NOT NULL,
  "summaryId" UUID NOT NULL,
  "status" "RoomKeywordSummaryJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
  "leaseId" UUID,
  "lockedUntil" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "lastError" VARCHAR(64),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RoomKeywordSummaryJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VocabularyItem" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "kind" "RoomKeywordItemKind" NOT NULL,
  "displayText" VARCHAR(120) NOT NULL,
  "normalizedText" VARCHAR(120) NOT NULL,
  "note" VARCHAR(500),
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "sourceSummaryItemId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "VocabularyItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VocabularyCommand" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "action" "VocabularyCommandAction" NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "resultItemId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VocabularyCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomKeywordSummary_roomId_key" ON "RoomKeywordSummary"("roomId");
CREATE INDEX "RoomKeywordSummary_status_updatedAt_id_idx" ON "RoomKeywordSummary"("status", "updatedAt", "id");
CREATE UNIQUE INDEX "RoomKeywordSummaryItem_summaryId_kind_normalizedText_key" ON "RoomKeywordSummaryItem"("summaryId", "kind", "normalizedText");
CREATE UNIQUE INDEX "RoomKeywordSummaryItem_summaryId_rank_key" ON "RoomKeywordSummaryItem"("summaryId", "rank");
CREATE INDEX "RoomKeywordSummaryItem_summaryId_rank_id_idx" ON "RoomKeywordSummaryItem"("summaryId", "rank", "id");
CREATE UNIQUE INDEX "RoomKeywordSummaryJob_summaryId_key" ON "RoomKeywordSummaryJob"("summaryId");
CREATE INDEX "RoomKeywordSummaryJob_status_nextAttemptAt_id_idx" ON "RoomKeywordSummaryJob"("status", "nextAttemptAt", "id");
CREATE INDEX "RoomKeywordSummaryJob_status_lockedUntil_id_idx" ON "RoomKeywordSummaryJob"("status", "lockedUntil", "id");
CREATE UNIQUE INDEX "VocabularyItem_userId_sourceSummaryItemId_key" ON "VocabularyItem"("userId", "sourceSummaryItemId");
CREATE INDEX "VocabularyItem_userId_updatedAt_id_idx" ON "VocabularyItem"("userId", "updatedAt", "id");
CREATE INDEX "VocabularyItem_userId_favorite_kind_updatedAt_id_idx" ON "VocabularyItem"("userId", "favorite", "kind", "updatedAt", "id");
CREATE UNIQUE INDEX "VocabularyCommand_userId_clientRequestId_key" ON "VocabularyCommand"("userId", "clientRequestId");
CREATE INDEX "VocabularyCommand_createdAt_id_idx" ON "VocabularyCommand"("createdAt", "id");

ALTER TABLE "RoomKeywordSummary"
  ADD CONSTRAINT "RoomKeywordSummary_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomKeywordSummaryItem"
  ADD CONSTRAINT "RoomKeywordSummaryItem_summaryId_fkey"
  FOREIGN KEY ("summaryId") REFERENCES "RoomKeywordSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomKeywordSummaryJob"
  ADD CONSTRAINT "RoomKeywordSummaryJob_summaryId_fkey"
  FOREIGN KEY ("summaryId") REFERENCES "RoomKeywordSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabularyItem"
  ADD CONSTRAINT "VocabularyItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VocabularyItem"
  ADD CONSTRAINT "VocabularyItem_sourceSummaryItemId_fkey"
  FOREIGN KEY ("sourceSummaryItemId") REFERENCES "RoomKeywordSummaryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VocabularyCommand"
  ADD CONSTRAINT "VocabularyCommand_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VocabularyCommand"
  ADD CONSTRAINT "VocabularyCommand_resultItemId_fkey"
  FOREIGN KEY ("resultItemId") REFERENCES "VocabularyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
