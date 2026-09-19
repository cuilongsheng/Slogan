ALTER TYPE "BackofficeAuditActorType" ADD VALUE 'SYSTEM_JOB';

ALTER TABLE "BackofficeAuditEvent" DROP CONSTRAINT "BackofficeAuditEvent_actor_shape_check";
ALTER TABLE "BackofficeAuditEvent" ADD CONSTRAINT "BackofficeAuditEvent_actor_shape_check" CHECK (
  ("actorType"::text IN ('SYSTEM_BOOTSTRAP', 'SYSTEM_JOB') AND "actorUserId" IS NULL)
  OR ("actorType"::text = 'USER' AND "actorUserId" IS NOT NULL)
);

CREATE TYPE "SafetyCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
CREATE TYPE "SafetySeverity" AS ENUM ('GENERAL', 'SERIOUS', 'HIGH_RISK');
CREATE TYPE "SafetyDecisionType" AS ENUM ('NO_ACTION', 'TEMPORARY_RESTRICTION', 'PERMANENT_DISABLE', 'DISMISSED');
CREATE TYPE "SafetyCaseActivityType" AS ENUM ('CREATED', 'UNASSIGNED', 'ASSIGNED', 'REASSIGNED', 'CLAIMED', 'REVIEW_STARTED', 'RESOLVED', 'DISMISSED', 'RESTRICTION_EXPIRED', 'RESTRICTION_LIFTED', 'APPEAL_SUBMITTED', 'APPEAL_UPHELD', 'APPEAL_LIFTED');
CREATE TYPE "SafetyActivityActorType" AS ENUM ('USER', 'SYSTEM_JOB');
CREATE TYPE "SafetyRestrictionKind" AS ENUM ('TEMPORARY', 'PERMANENT');
CREATE TYPE "SafetyRestrictionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'LIFTED');
CREATE TYPE "SafetyAppealStatus" AS ENUM ('PENDING', 'UPHELD', 'LIFTED');

CREATE TABLE "SafetyCase" (
  "id" UUID NOT NULL,
  "reportId" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "targetUserId" UUID NOT NULL,
  "status" "SafetyCaseStatus" NOT NULL DEFAULT 'OPEN',
  "assigneeUserId" UUID,
  "assignedAt" TIMESTAMPTZ(3),
  "reviewStartedAt" TIMESTAMPTZ(3),
  "assessedSeverity" "SafetySeverity",
  "decisionType" "SafetyDecisionType",
  "decisionReason" VARCHAR(500),
  "decidedAt" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SafetyCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SafetyCase_version_check" CHECK ("version" > 0),
  CONSTRAINT "SafetyCase_assignee_shape_check" CHECK (("assigneeUserId" IS NULL) = ("assignedAt" IS NULL)),
  CONSTRAINT "SafetyCase_terminal_shape_check" CHECK (
    ("status" IN ('OPEN', 'UNDER_REVIEW') AND "decisionType" IS NULL AND "decisionReason" IS NULL AND "decidedAt" IS NULL)
    OR ("status" = 'RESOLVED' AND "decisionType" IN ('NO_ACTION', 'TEMPORARY_RESTRICTION', 'PERMANENT_DISABLE') AND "decisionReason" IS NOT NULL AND "decidedAt" IS NOT NULL)
    OR ("status" = 'DISMISSED' AND "decisionType" = 'DISMISSED' AND "decisionReason" IS NOT NULL AND "decidedAt" IS NOT NULL)
  ),
  CONSTRAINT "SafetyCase_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SafetyCase_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SafetyCase_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SafetyCase_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SafetyCase_reportId_key" ON "SafetyCase"("reportId");
CREATE INDEX "SafetyCase_status_createdAt_id_idx" ON "SafetyCase"("status", "createdAt", "id");
CREATE INDEX "SafetyCase_assigneeUserId_status_createdAt_id_idx" ON "SafetyCase"("assigneeUserId", "status", "createdAt", "id");
CREATE INDEX "SafetyCase_targetUserId_createdAt_id_idx" ON "SafetyCase"("targetUserId", "createdAt", "id");
CREATE INDEX "SafetyCase_roomId_createdAt_id_idx" ON "SafetyCase"("roomId", "createdAt", "id");

CREATE TABLE "SafetyCaseParticipantSnapshot" (
  "id" UUID NOT NULL,
  "caseId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "RoomMembershipRole" NOT NULL,
  "lifecycle" "MembershipLifecycle" NOT NULL,
  "joinedAt" TIMESTAMPTZ(3) NOT NULL,
  "leftAt" TIMESTAMPTZ(3),
  "removedAt" TIMESTAMPTZ(3),
  "capturedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SafetyCaseParticipantSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SafetyCaseParticipantSnapshot_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SafetyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SafetyCaseParticipantSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SafetyCaseParticipantSnapshot_caseId_userId_key" ON "SafetyCaseParticipantSnapshot"("caseId", "userId");
CREATE INDEX "SafetyCaseParticipantSnapshot_userId_capturedAt_idx" ON "SafetyCaseParticipantSnapshot"("userId", "capturedAt");

CREATE TABLE "SafetyCaseActivity" (
  "id" UUID NOT NULL,
  "caseId" UUID NOT NULL,
  "type" "SafetyCaseActivityType" NOT NULL,
  "actorType" "SafetyActivityActorType" NOT NULL,
  "actorUserId" UUID,
  "fromStatus" "SafetyCaseStatus",
  "toStatus" "SafetyCaseStatus",
  "assigneeUserId" UUID,
  "reason" VARCHAR(500),
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SafetyCaseActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SafetyCaseActivity_actor_shape_check" CHECK (("actorType" = 'SYSTEM_JOB' AND "actorUserId" IS NULL) OR ("actorType" = 'USER' AND "actorUserId" IS NOT NULL)),
  CONSTRAINT "SafetyCaseActivity_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SafetyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SafetyCaseActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SafetyCaseActivity_caseId_occurredAt_id_idx" ON "SafetyCaseActivity"("caseId", "occurredAt", "id");

CREATE TABLE "SafetyRestriction" (
  "id" UUID NOT NULL,
  "caseId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "kind" "SafetyRestrictionKind" NOT NULL,
  "severity" "SafetySeverity" NOT NULL,
  "status" "SafetyRestrictionStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" VARCHAR(500) NOT NULL,
  "decidedByUserId" UUID NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3),
  "appealDeadlineAt" TIMESTAMPTZ(3),
  "liftedAt" TIMESTAMPTZ(3),
  "liftedByUserId" UUID,
  "liftReason" VARCHAR(500),
  "expiredAt" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SafetyRestriction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SafetyRestriction_version_check" CHECK ("version" > 0),
  CONSTRAINT "SafetyRestriction_time_shape_check" CHECK (
    ("kind" = 'TEMPORARY' AND "endsAt" IS NOT NULL AND "appealDeadlineAt" IS NOT NULL AND "endsAt" > "startsAt")
    OR ("kind" = 'PERMANENT' AND "endsAt" IS NULL AND "appealDeadlineAt" IS NULL)
  ),
  CONSTRAINT "SafetyRestriction_lift_shape_check" CHECK (
    ("liftedAt" IS NULL AND "liftedByUserId" IS NULL AND "liftReason" IS NULL)
    OR ("liftedAt" IS NOT NULL AND "liftedByUserId" IS NOT NULL AND "liftReason" IS NOT NULL)
  ),
  CONSTRAINT "SafetyRestriction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SafetyCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SafetyRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SafetyRestriction_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SafetyRestriction_liftedByUserId_fkey" FOREIGN KEY ("liftedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SafetyRestriction_caseId_key" ON "SafetyRestriction"("caseId");
CREATE INDEX "SafetyRestriction_userId_status_endsAt_id_idx" ON "SafetyRestriction"("userId", "status", "endsAt", "id");
CREATE INDEX "SafetyRestriction_status_endsAt_id_idx" ON "SafetyRestriction"("status", "endsAt", "id");

CREATE TABLE "SafetyAppeal" (
  "id" UUID NOT NULL,
  "restrictionId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "SafetyAppealStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMPTZ(3),
  "decidedByUserId" UUID,
  "decisionReason" VARCHAR(500),
  CONSTRAINT "SafetyAppeal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SafetyAppeal_reason_length_check" CHECK (char_length("reason") BETWEEN 1 AND 2000),
  CONSTRAINT "SafetyAppeal_decision_shape_check" CHECK (
    ("status" = 'PENDING' AND "decidedAt" IS NULL AND "decidedByUserId" IS NULL AND "decisionReason" IS NULL)
    OR ("status" IN ('UPHELD', 'LIFTED') AND "decidedAt" IS NOT NULL AND "decidedByUserId" IS NOT NULL AND "decisionReason" IS NOT NULL)
  ),
  CONSTRAINT "SafetyAppeal_restrictionId_fkey" FOREIGN KEY ("restrictionId") REFERENCES "SafetyRestriction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SafetyAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SafetyAppeal_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SafetyAppeal_restrictionId_key" ON "SafetyAppeal"("restrictionId");
CREATE INDEX "SafetyAppeal_status_submittedAt_id_idx" ON "SafetyAppeal"("status", "submittedAt", "id");
CREATE INDEX "SafetyAppeal_userId_submittedAt_id_idx" ON "SafetyAppeal"("userId", "submittedAt", "id");

CREATE TABLE "SafetyCommand" (
  "id" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "resourceType" VARCHAR(64) NOT NULL,
  "resourceId" UUID NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SafetyCommand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SafetyCommand_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SafetyCommand_actorUserId_clientRequestId_key" ON "SafetyCommand"("actorUserId", "clientRequestId");
CREATE INDEX "SafetyCommand_resourceType_resourceId_createdAt_idx" ON "SafetyCommand"("resourceType", "resourceId", "createdAt");

CREATE TABLE "SafetyAssignmentState" (
  "key" VARCHAR(32) NOT NULL,
  "lastAssigneeUserId" UUID,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SafetyAssignmentState_pkey" PRIMARY KEY ("key")
);
INSERT INTO "SafetyAssignmentState" ("key", "lastAssigneeUserId", "updatedAt") VALUES ('GLOBAL', NULL, CURRENT_TIMESTAMP);

INSERT INTO "SafetyCase" (
  "id", "reportId", "roomId", "targetUserId", "status", "version", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), r."id", r."roomId", r."targetUserId", 'OPEN', 1, r."submittedAt", r."submittedAt"
FROM "Report" r
ON CONFLICT ("reportId") DO NOTHING;

INSERT INTO "SafetyCaseActivity" (
  "id", "caseId", "type", "actorType", "fromStatus", "toStatus", "occurredAt"
)
SELECT gen_random_uuid(), c."id", 'CREATED', 'SYSTEM_JOB', NULL, 'OPEN', c."createdAt"
FROM "SafetyCase" c
WHERE NOT EXISTS (
  SELECT 1 FROM "SafetyCaseActivity" a WHERE a."caseId" = c."id" AND a."type" = 'CREATED'
);

INSERT INTO "SafetyCaseActivity" (
  "id", "caseId", "type", "actorType", "fromStatus", "toStatus", "occurredAt"
)
SELECT gen_random_uuid(), c."id", 'UNASSIGNED', 'SYSTEM_JOB', 'OPEN', 'OPEN', c."createdAt"
FROM "SafetyCase" c
WHERE c."assigneeUserId" IS NULL AND NOT EXISTS (
  SELECT 1 FROM "SafetyCaseActivity" a WHERE a."caseId" = c."id" AND a."type" = 'UNASSIGNED'
);

INSERT INTO "SafetyCaseParticipantSnapshot" (
  "id", "caseId", "userId", "role", "lifecycle", "joinedAt", "leftAt", "removedAt", "capturedAt"
)
SELECT gen_random_uuid(), c."id", m."userId", m."role", m."lifecycle", m."joinedAt", m."leftAt", m."removedAt", c."createdAt"
FROM "SafetyCase" c
JOIN "RoomMembership" m ON m."roomId" = c."roomId" AND m."joinedAt" <= c."createdAt"
ON CONFLICT ("caseId", "userId") DO NOTHING;
