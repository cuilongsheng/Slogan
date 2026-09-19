ALTER TYPE "SpeechProcessingPurpose" ADD VALUE IF NOT EXISTS 'ROOM_SAFETY_DETECTION';

CREATE TYPE "RoomSpeechRiskCategory" AS ENUM (
  'HARASSMENT_ABUSE',
  'HATE_DISCRIMINATION',
  'SEXUAL_CONTENT',
  'THREAT_VIOLENCE',
  'SPAM_ADVERTISING',
  'OTHER_SAFETY_RISK'
);
CREATE TYPE "RoomSpeechRiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "RoomSpeechAlertDeliveryStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'DELIVERED',
  'EXPIRED',
  'FAILED'
);
CREATE TYPE "SafetyCapabilityComponent" AS ENUM (
  'MEDIA_SUBSCRIPTION',
  'STREAMING_STT',
  'RISK_RULES',
  'COORDINATION',
  'HOST_ALERT_DELIVERY'
);
CREATE TYPE "SafetyCapabilityIncidentStatus" AS ENUM ('OPEN', 'RECOVERED');

ALTER TABLE "Room"
  ADD COLUMN "sensitiveSpeechDetectionEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE FUNCTION "preventRoomSpeechDetectionChange"() RETURNS trigger AS $$
BEGIN
  IF NEW."sensitiveSpeechDetectionEnabled" IS DISTINCT FROM OLD."sensitiveSpeechDetectionEnabled" THEN
    RAISE EXCEPTION 'room speech detection setting is immutable after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Room_sensitiveSpeechDetectionEnabled_immutable"
  BEFORE UPDATE OF "sensitiveSpeechDetectionEnabled" ON "Room"
  FOR EACH ROW EXECUTE FUNCTION "preventRoomSpeechDetectionChange"();

CREATE TABLE "RoomSpeechRiskEvent" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "subjectUserId" UUID NOT NULL,
  "category" "RoomSpeechRiskCategory" NOT NULL,
  "severity" "RoomSpeechRiskSeverity" NOT NULL,
  "ruleSetVersion" VARCHAR(64) NOT NULL,
  "correlationHash" CHAR(64) NOT NULL,
  "firstOccurredAt" TIMESTAMPTZ(3) NOT NULL,
  "lastOccurredAt" TIMESTAMPTZ(3) NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomSpeechRiskEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomSpeechAlertDelivery" (
  "id" UUID NOT NULL,
  "riskEventId" UUID NOT NULL,
  "status" "RoomSpeechAlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "lockedUntil" TIMESTAMPTZ(3),
  "leaseId" UUID,
  "deliveredAt" TIMESTAMPTZ(3),
  "lastError" VARCHAR(64),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomSpeechAlertDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SafetyCapabilityIncident" (
  "id" UUID NOT NULL,
  "roomId" UUID,
  "component" "SafetyCapabilityComponent" NOT NULL,
  "errorCategory" VARCHAR(64) NOT NULL,
  "providerCategory" VARCHAR(64),
  "activeKey" VARCHAR(255),
  "status" "SafetyCapabilityIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "startedAt" TIMESTAMPTZ(3) NOT NULL,
  "lastObservedAt" TIMESTAMPTZ(3) NOT NULL,
  "recoveredAt" TIMESTAMPTZ(3),
  "affectedWindows" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SafetyCapabilityIncident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomSpeechRiskEvent_roomId_subjectUserId_category_ruleSetVersion_correlationHash_key"
  ON "RoomSpeechRiskEvent"("roomId", "subjectUserId", "category", "ruleSetVersion", "correlationHash");
CREATE INDEX "RoomSpeechRiskEvent_roomId_lastOccurredAt_id_idx"
  ON "RoomSpeechRiskEvent"("roomId", "lastOccurredAt", "id");
CREATE INDEX "RoomSpeechRiskEvent_subjectUserId_lastOccurredAt_idx"
  ON "RoomSpeechRiskEvent"("subjectUserId", "lastOccurredAt");

CREATE UNIQUE INDEX "RoomSpeechAlertDelivery_riskEventId_key"
  ON "RoomSpeechAlertDelivery"("riskEventId");
CREATE INDEX "RoomSpeechAlertDelivery_status_nextAttemptAt_idx"
  ON "RoomSpeechAlertDelivery"("status", "nextAttemptAt");

CREATE UNIQUE INDEX "SafetyCapabilityIncident_activeKey_key"
  ON "SafetyCapabilityIncident"("activeKey");
CREATE INDEX "SafetyCapabilityIncident_status_lastObservedAt_id_idx"
  ON "SafetyCapabilityIncident"("status", "lastObservedAt", "id");
CREATE INDEX "SafetyCapabilityIncident_roomId_startedAt_id_idx"
  ON "SafetyCapabilityIncident"("roomId", "startedAt", "id");
CREATE INDEX "SafetyCapabilityIncident_component_status_lastObservedAt_idx"
  ON "SafetyCapabilityIncident"("component", "status", "lastObservedAt");

ALTER TABLE "RoomSpeechRiskEvent"
  ADD CONSTRAINT "RoomSpeechRiskEvent_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomSpeechRiskEvent"
  ADD CONSTRAINT "RoomSpeechRiskEvent_subjectUserId_fkey"
  FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomSpeechAlertDelivery"
  ADD CONSTRAINT "RoomSpeechAlertDelivery_riskEventId_fkey"
  FOREIGN KEY ("riskEventId") REFERENCES "RoomSpeechRiskEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyCapabilityIncident"
  ADD CONSTRAINT "SafetyCapabilityIncident_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
