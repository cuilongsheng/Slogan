CREATE TYPE "AiExpressionInputMode" AS ENUM ('TEXT', 'AUDIO');
CREATE TYPE "AiExpressionStatus" AS ENUM ('RESERVED', 'STT_RUNNING', 'AI_RUNNING', 'SUCCEEDED', 'FAILED', 'UNCERTAIN');
CREATE TYPE "AiUsageKind" AS ENUM ('AI_EXPRESSION', 'STT_AUDIO');
CREATE TYPE "SpeechProcessingPurpose" AS ENUM ('AI_EXPRESSION_AUDIO');
CREATE TYPE "SpeechConsentAction" AS ENUM ('ACCEPT', 'REVOKE');

CREATE TABLE "AiExpressionRequest" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "inputMode" "AiExpressionInputMode" NOT NULL,
  "inputDigest" CHAR(64) NOT NULL,
  "status" "AiExpressionStatus" NOT NULL DEFAULT 'RESERVED',
  "leaseToken" UUID,
  "leaseExpiresAt" TIMESTAMPTZ(3),
  "providerCategory" VARCHAR(64),
  "inputSize" INTEGER NOT NULL,
  "audioDurationMs" INTEGER,
  "output" JSONB,
  "outputExpiresAt" TIMESTAMPTZ(3),
  "outputPurgedAt" TIMESTAMPTZ(3),
  "errorCode" VARCHAR(64),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(3),
  CONSTRAINT "AiExpressionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiExpressionRequest_input_size_check" CHECK ("inputSize" > 0),
  CONSTRAINT "AiExpressionRequest_audio_duration_check" CHECK ("audioDurationMs" IS NULL OR "audioDurationMs" >= 0),
  CONSTRAINT "AiExpressionRequest_output_check" CHECK (("output" IS NULL AND "outputExpiresAt" IS NULL) OR ("output" IS NOT NULL AND "outputExpiresAt" IS NOT NULL)),
  CONSTRAINT "AiExpressionRequest_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AiExpressionRequest_room_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiExpressionRequest_userId_clientRequestId_key" ON "AiExpressionRequest"("userId", "clientRequestId");
CREATE INDEX "AiExpressionRequest_roomId_userId_createdAt_idx" ON "AiExpressionRequest"("roomId", "userId", "createdAt");
CREATE INDEX "AiExpressionRequest_status_leaseExpiresAt_idx" ON "AiExpressionRequest"("status", "leaseExpiresAt");
CREATE INDEX "AiExpressionRequest_outputExpiresAt_outputPurgedAt_idx" ON "AiExpressionRequest"("outputExpiresAt", "outputPurgedAt");

CREATE TABLE "AiUsageLedger" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "kind" "AiUsageKind" NOT NULL,
  "quotaDate" DATE NOT NULL,
  "reservedUnits" INTEGER NOT NULL,
  "actualUnits" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsageLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiUsageLedger_units_check" CHECK ("reservedUnits" >= 0 AND "actualUnits" >= 0),
  CONSTRAINT "AiUsageLedger_request_fkey" FOREIGN KEY ("requestId") REFERENCES "AiExpressionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiUsageLedger_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiUsageLedger_requestId_kind_key" ON "AiUsageLedger"("requestId", "kind");
CREATE INDEX "AiUsageLedger_userId_quotaDate_kind_idx" ON "AiUsageLedger"("userId", "quotaDate", "kind");
CREATE INDEX "AiUsageLedger_quotaDate_kind_idx" ON "AiUsageLedger"("quotaDate", "kind");

CREATE TABLE "SpeechProcessingConsentEvent" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "purpose" "SpeechProcessingPurpose" NOT NULL,
  "action" "SpeechConsentAction" NOT NULL,
  "noticeVersion" VARCHAR(64) NOT NULL,
  "providerCategory" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpeechProcessingConsentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpeechProcessingConsentEvent_notice_check" CHECK (length(btrim("noticeVersion")) > 0),
  CONSTRAINT "SpeechProcessingConsentEvent_provider_check" CHECK (length(btrim("providerCategory")) > 0),
  CONSTRAINT "SpeechProcessingConsentEvent_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SpeechProcessingConsentEvent_userId_clientRequestId_key" ON "SpeechProcessingConsentEvent"("userId", "clientRequestId");
CREATE INDEX "SpeechProcessingConsentEvent_userId_purpose_createdAt_id_idx" ON "SpeechProcessingConsentEvent"("userId", "purpose", "createdAt", "id");
