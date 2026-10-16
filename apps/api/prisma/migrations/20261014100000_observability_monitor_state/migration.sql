CREATE TABLE "ObservabilityMonitorState" (
  "environment" VARCHAR(16) NOT NULL,
  "monitorKey" VARCHAR(64) NOT NULL,
  "completedWindow" BIGINT NOT NULL DEFAULT -1,
  "nextWindow" BIGINT,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "lastCompletedAt" TIMESTAMPTZ(3),
  "leaseId" UUID,
  "lockedUntil" TIMESTAMPTZ(3),
  "generation" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ObservabilityMonitorState_pkey" PRIMARY KEY ("environment", "monitorKey")
);
