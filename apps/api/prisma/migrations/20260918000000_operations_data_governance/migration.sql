CREATE TYPE "MetricGrain" AS ENUM ('DAY', 'WEEK');
CREATE TYPE "MetricSnapshotStatus" AS ENUM ('COMPLETE', 'PARTIAL', 'UNAVAILABLE');
CREATE TYPE "MetricRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "OperationalIncidentSeverity" AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');
CREATE TYPE "OperationalIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "OperationalAlertDeliveryStatus" AS ENUM ('PENDING', 'RUNNING', 'DELIVERED', 'FAILED');
CREATE TYPE "OperationalCommandAction" AS ENUM ('ACKNOWLEDGE_INCIDENT', 'RESOLVE_INCIDENT');
CREATE TYPE "RetentionDataCategory" AS ENUM (
  'TEMPORARY_SPEECH_CONTENT',
  'SHORT_TERM_AI_OUTPUT',
  'TEMPORARY_COORDINATION',
  'TECHNICAL_COMMAND',
  'OPERATIONS_METRIC',
  'ACCOUNT_IDENTITY',
  'USER_PRIVATE_CONTENT',
  'SAFETY_EVIDENCE',
  'ENFORCEMENT_APPEAL',
  'BACKOFFICE_AUDIT'
);
CREATE TYPE "RetentionPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');
CREATE TYPE "RetentionRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "DeletionEvidenceResult" AS ENUM ('COMPLETED', 'UNCERTAIN', 'FAILED');
CREATE TYPE "RecoveryDrillEnvironment" AS ENUM ('LOCAL', 'TARGET');
CREATE TYPE "RecoveryDrillStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "MetricComputationRun" (
  "id" UUID NOT NULL,
  "grain" "MetricGrain" NOT NULL,
  "windowStart" TIMESTAMPTZ(3) NOT NULL,
  "windowEnd" TIMESTAMPTZ(3) NOT NULL,
  "definitionVersion" VARCHAR(64) NOT NULL,
  "status" "MetricRunStatus" NOT NULL DEFAULT 'PENDING',
  "generation" INTEGER NOT NULL DEFAULT 0,
  "leaseId" UUID,
  "lockedUntil" TIMESTAMPTZ(3),
  "watermark" TIMESTAMPTZ(3),
  "errorCode" VARCHAR(64),
  "startedAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "MetricComputationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetricSnapshot" (
  "id" UUID NOT NULL,
  "runId" UUID NOT NULL,
  "metricKey" VARCHAR(64) NOT NULL,
  "grain" "MetricGrain" NOT NULL,
  "windowStart" TIMESTAMPTZ(3) NOT NULL,
  "windowEnd" TIMESTAMPTZ(3) NOT NULL,
  "dimensionKey" VARCHAR(256) NOT NULL,
  "dimensions" JSONB NOT NULL,
  "definitionVersion" VARCHAR(64) NOT NULL,
  "status" "MetricSnapshotStatus" NOT NULL,
  "value" DECIMAL(24,6),
  "numerator" BIGINT,
  "denominator" BIGINT,
  "sampleSize" INTEGER NOT NULL,
  "reasonCode" VARCHAR(64),
  "dataThroughAt" TIMESTAMPTZ(3) NOT NULL,
  "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalIncident" (
  "id" UUID NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "occurrence" INTEGER NOT NULL,
  "component" VARCHAR(64) NOT NULL,
  "category" VARCHAR(64) NOT NULL,
  "severity" "OperationalIncidentSeverity" NOT NULL,
  "scopeType" VARCHAR(64) NOT NULL,
  "scopeKey" VARCHAR(128) NOT NULL,
  "ruleVersion" VARCHAR(64) NOT NULL,
  "reasonCode" VARCHAR(64) NOT NULL,
  "status" "OperationalIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "observationCount" INTEGER NOT NULL DEFAULT 1,
  "firstObservedAt" TIMESTAMPTZ(3) NOT NULL,
  "lastObservedAt" TIMESTAMPTZ(3) NOT NULL,
  "acknowledgedAt" TIMESTAMPTZ(3),
  "acknowledgedBy" UUID,
  "acknowledgeReason" VARCHAR(500),
  "resolvedAt" TIMESTAMPTZ(3),
  "resolvedBy" UUID,
  "resolutionReason" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OperationalIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalIncidentObservation" (
  "id" UUID NOT NULL,
  "incidentId" UUID NOT NULL,
  "reasonCode" VARCHAR(64) NOT NULL,
  "observedAt" TIMESTAMPTZ(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "OperationalIncidentObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalAlertDelivery" (
  "id" UUID NOT NULL,
  "incidentId" UUID NOT NULL,
  "status" "OperationalAlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseId" UUID,
  "generation" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ(3),
  "lastError" VARCHAR(64),
  "deliveredAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OperationalAlertDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalCommand" (
  "id" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "action" "OperationalCommandAction" NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalCommand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetentionPolicyVersion" (
  "id" UUID NOT NULL,
  "category" "RetentionDataCategory" NOT NULL,
  "scopeKey" VARCHAR(128) NOT NULL,
  "version" INTEGER NOT NULL,
  "retentionSeconds" INTEGER,
  "rationaleRef" VARCHAR(256) NOT NULL,
  "automatic" BOOLEAN NOT NULL DEFAULT false,
  "status" "RetentionPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMPTZ(3),
  CONSTRAINT "RetentionPolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetentionDryRun" (
  "id" UUID NOT NULL,
  "policyId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "boundaryEligibleAt" TIMESTAMPTZ(3) NOT NULL,
  "candidateCount" INTEGER NOT NULL,
  "earliestEligibleAt" TIMESTAMPTZ(3),
  "latestEligibleAt" TIMESTAMPTZ(3),
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionDryRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetentionRun" (
  "id" UUID NOT NULL,
  "policyId" UUID NOT NULL,
  "dryRunId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "status" "RetentionRunStatus" NOT NULL DEFAULT 'PENDING',
  "generation" INTEGER NOT NULL DEFAULT 0,
  "leaseId" UUID,
  "lockedUntil" TIMESTAMPTZ(3),
  "cursorAt" TIMESTAMPTZ(3),
  "cursorId" VARCHAR(128),
  "scannedCount" INTEGER NOT NULL DEFAULT 0,
  "deletedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" VARCHAR(64),
  "startedAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RetentionRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetentionRunBatch" (
  "id" UUID NOT NULL,
  "runId" UUID NOT NULL,
  "generation" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "cursorAt" TIMESTAMPTZ(3),
  "cursorId" VARCHAR(128),
  "scannedCount" INTEGER NOT NULL,
  "deletedCount" INTEGER NOT NULL,
  "skippedCount" INTEGER NOT NULL,
  "failedCount" INTEGER NOT NULL,
  "committedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionRunBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetentionHold" (
  "id" UUID NOT NULL,
  "category" "RetentionDataCategory" NOT NULL,
  "targetType" VARCHAR(64),
  "targetId" VARCHAR(128),
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3),
  "reason" VARCHAR(500) NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMPTZ(3),
  "releasedByUserId" UUID,
  "releaseReason" VARCHAR(500),
  CONSTRAINT "RetentionHold_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeletionEvidence" (
  "id" UUID NOT NULL,
  "category" "RetentionDataCategory" NOT NULL,
  "purpose" VARCHAR(64) NOT NULL,
  "providerCategory" VARCHAR(64),
  "policyVersion" VARCHAR(64) NOT NULL,
  "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
  "completedAt" TIMESTAMPTZ(3),
  "result" "DeletionEvidenceResult" NOT NULL,
  "reasonCode" VARCHAR(64),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeletionEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecoveryDrill" (
  "id" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "environment" "RecoveryDrillEnvironment" NOT NULL,
  "environmentId" VARCHAR(64) NOT NULL,
  "backupDigest" CHAR(64) NOT NULL,
  "toolVersion" VARCHAR(64) NOT NULL,
  "schemaVersion" VARCHAR(128) NOT NULL,
  "status" "RecoveryDrillStatus" NOT NULL DEFAULT 'RUNNING',
  "observedRpoSeconds" INTEGER,
  "observedRtoSeconds" INTEGER,
  "checkSummary" JSONB NOT NULL,
  "errorCode" VARCHAR(64),
  "startedAt" TIMESTAMPTZ(3) NOT NULL,
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecoveryDrill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomShareAttribution" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "joinedAt" TIMESTAMPTZ(3),
  CONSTRAINT "RoomShareAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetricComputationRun_grain_windowStart_windowEnd_definition_key"
ON "MetricComputationRun"("grain", "windowStart", "windowEnd", "definitionVersion");
CREATE INDEX "MetricComputationRun_status_lockedUntil_windowStart_idx"
ON "MetricComputationRun"("status", "lockedUntil", "windowStart");
CREATE UNIQUE INDEX "MetricSnapshot_identity_key"
ON "MetricSnapshot"("metricKey", "grain", "windowStart", "windowEnd", "dimensionKey", "definitionVersion");
CREATE INDEX "MetricSnapshot_metricKey_grain_windowStart_id_idx"
ON "MetricSnapshot"("metricKey", "grain", "windowStart", "id");
CREATE INDEX "MetricSnapshot_generatedAt_id_idx" ON "MetricSnapshot"("generatedAt", "id");
CREATE UNIQUE INDEX "OperationalIncident_fingerprint_occurrence_key"
ON "OperationalIncident"("fingerprint", "occurrence");
CREATE UNIQUE INDEX "OperationalIncident_one_current_key"
ON "OperationalIncident"("fingerprint") WHERE "status" <> 'RESOLVED';
CREATE INDEX "OperationalIncident_fingerprint_status_idx" ON "OperationalIncident"("fingerprint", "status");
CREATE INDEX "OperationalIncident_status_severity_lastObservedAt_id_idx"
ON "OperationalIncident"("status", "severity", "lastObservedAt", "id");
CREATE INDEX "OperationalIncidentObservation_incidentId_observedAt_id_idx"
ON "OperationalIncidentObservation"("incidentId", "observedAt", "id");
CREATE UNIQUE INDEX "OperationalAlertDelivery_incidentId_key" ON "OperationalAlertDelivery"("incidentId");
CREATE INDEX "OperationalAlertDelivery_status_nextAttemptAt_lockedUntil_idx"
ON "OperationalAlertDelivery"("status", "nextAttemptAt", "lockedUntil");
CREATE UNIQUE INDEX "OperationalCommand_actorUserId_clientRequestId_key"
ON "OperationalCommand"("actorUserId", "clientRequestId");
CREATE INDEX "OperationalCommand_createdAt_id_idx" ON "OperationalCommand"("createdAt", "id");
CREATE UNIQUE INDEX "RetentionPolicyVersion_category_scopeKey_version_key"
ON "RetentionPolicyVersion"("category", "scopeKey", "version");
CREATE UNIQUE INDEX "RetentionPolicyVersion_one_active_key"
ON "RetentionPolicyVersion"("category", "scopeKey") WHERE "status" = 'ACTIVE';
CREATE INDEX "RetentionPolicyVersion_category_scopeKey_status_idx"
ON "RetentionPolicyVersion"("category", "scopeKey", "status");
CREATE UNIQUE INDEX "RetentionDryRun_actorUserId_clientRequestId_key"
ON "RetentionDryRun"("actorUserId", "clientRequestId");
CREATE INDEX "RetentionDryRun_policyId_expiresAt_id_idx" ON "RetentionDryRun"("policyId", "expiresAt", "id");
CREATE UNIQUE INDEX "RetentionRun_dryRunId_key" ON "RetentionRun"("dryRunId");
CREATE UNIQUE INDEX "RetentionRun_actorUserId_clientRequestId_key"
ON "RetentionRun"("actorUserId", "clientRequestId");
CREATE INDEX "RetentionRun_status_lockedUntil_createdAt_idx"
ON "RetentionRun"("status", "lockedUntil", "createdAt");
CREATE UNIQUE INDEX "RetentionRunBatch_runId_generation_sequence_key"
ON "RetentionRunBatch"("runId", "generation", "sequence");
CREATE INDEX "RetentionRunBatch_runId_committedAt_idx" ON "RetentionRunBatch"("runId", "committedAt");
CREATE INDEX "RetentionHold_category_startsAt_endsAt_idx" ON "RetentionHold"("category", "startsAt", "endsAt");
CREATE INDEX "RetentionHold_targetType_targetId_releasedAt_idx"
ON "RetentionHold"("targetType", "targetId", "releasedAt");
CREATE INDEX "DeletionEvidence_result_deadlineAt_id_idx" ON "DeletionEvidence"("result", "deadlineAt", "id");
CREATE INDEX "DeletionEvidence_category_createdAt_id_idx" ON "DeletionEvidence"("category", "createdAt", "id");
CREATE UNIQUE INDEX "RecoveryDrill_actorUserId_clientRequestId_key"
ON "RecoveryDrill"("actorUserId", "clientRequestId");
CREATE INDEX "RecoveryDrill_environment_startedAt_id_idx" ON "RecoveryDrill"("environment", "startedAt", "id");
CREATE INDEX "RoomShareAttribution_roomId_openedAt_id_idx" ON "RoomShareAttribution"("roomId", "openedAt", "id");
CREATE INDEX "RoomShareAttribution_joinedAt_openedAt_id_idx" ON "RoomShareAttribution"("joinedAt", "openedAt", "id");

ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "MetricComputationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalIncidentObservation" ADD CONSTRAINT "OperationalIncidentObservation_incidentId_fkey"
FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationalAlertDelivery" ADD CONSTRAINT "OperationalAlertDelivery_incidentId_fkey"
FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionDryRun" ADD CONSTRAINT "RetentionDryRun_policyId_fkey"
FOREIGN KEY ("policyId") REFERENCES "RetentionPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionRun" ADD CONSTRAINT "RetentionRun_policyId_fkey"
FOREIGN KEY ("policyId") REFERENCES "RetentionPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionRun" ADD CONSTRAINT "RetentionRun_dryRunId_fkey"
FOREIGN KEY ("dryRunId") REFERENCES "RetentionDryRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionRunBatch" ADD CONSTRAINT "RetentionRunBatch_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "RetentionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomShareAttribution" ADD CONSTRAINT "RoomShareAttribution_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
