CREATE TYPE "BackofficeRole" AS ENUM ('PLATFORM_ADMIN', 'SAFETY_OFFICER', 'OPERATIONS_ANALYST', 'AUDITOR');
CREATE TYPE "BackofficeAuditActorType" AS ENUM ('USER', 'SYSTEM_BOOTSTRAP');
CREATE TYPE "BackofficeAuditResult" AS ENUM ('SUCCEEDED', 'REJECTED');

CREATE TABLE "BackofficeRoleAssignment" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "role" "BackofficeRole" NOT NULL,
  "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "grantedByUserId" UUID,
  "revokedAt" TIMESTAMPTZ(3), "revokedByUserId" UUID, "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "BackofficeRoleAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BackofficeRoleAssignment_version_check" CHECK ("version" > 0),
  CONSTRAINT "BackofficeRoleAssignment_revoke_pair_check" CHECK (("revokedAt" IS NULL) = ("revokedByUserId" IS NULL)),
  CONSTRAINT "BackofficeRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BackofficeRoleAssignment_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BackofficeRoleAssignment_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BackofficeRoleAssignment_userId_role_key" ON "BackofficeRoleAssignment"("userId", "role");
CREATE INDEX "BackofficeRoleAssignment_role_revokedAt_userId_idx" ON "BackofficeRoleAssignment"("role", "revokedAt", "userId");
CREATE INDEX "BackofficeRoleAssignment_grantedAt_id_idx" ON "BackofficeRoleAssignment"("grantedAt", "id");

CREATE TABLE "BackofficeAuditEvent" (
  "id" UUID NOT NULL, "actorType" "BackofficeAuditActorType" NOT NULL, "actorUserId" UUID,
  "actorRoles" "BackofficeRole"[] NOT NULL, "action" VARCHAR(64) NOT NULL, "targetType" VARCHAR(64) NOT NULL,
  "targetId" VARCHAR(128), "role" "BackofficeRole", "reason" VARCHAR(500),
  "result" "BackofficeAuditResult" NOT NULL, "clientRequestId" UUID, "requestHash" VARCHAR(64),
  "requestId" VARCHAR(128), "details" JSONB, "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackofficeAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BackofficeAuditEvent_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BackofficeAuditEvent_actor_shape_check" CHECK (("actorType" = 'SYSTEM_BOOTSTRAP' AND "actorUserId" IS NULL) OR ("actorType" = 'USER' AND "actorUserId" IS NOT NULL)),
  CONSTRAINT "BackofficeAuditEvent_request_shape_check" CHECK (("clientRequestId" IS NULL) = ("requestHash" IS NULL))
);
CREATE UNIQUE INDEX "BackofficeAuditEvent_actorUserId_clientRequestId_key" ON "BackofficeAuditEvent"("actorUserId", "clientRequestId");
CREATE INDEX "BackofficeAuditEvent_occurredAt_id_idx" ON "BackofficeAuditEvent"("occurredAt", "id");
CREATE INDEX "BackofficeAuditEvent_actorUserId_occurredAt_id_idx" ON "BackofficeAuditEvent"("actorUserId", "occurredAt", "id");
CREATE INDEX "BackofficeAuditEvent_action_occurredAt_id_idx" ON "BackofficeAuditEvent"("action", "occurredAt", "id");
CREATE INDEX "BackofficeAuditEvent_targetType_targetId_occurredAt_id_idx" ON "BackofficeAuditEvent"("targetType", "targetId", "occurredAt", "id");
CREATE INDEX "BackofficeAuditEvent_result_occurredAt_id_idx" ON "BackofficeAuditEvent"("result", "occurredAt", "id");
