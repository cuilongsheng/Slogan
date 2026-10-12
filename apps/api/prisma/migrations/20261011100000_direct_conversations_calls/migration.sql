-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "directMessageId" UUID,
ALTER COLUMN "roomId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SafetyCase" ALTER COLUMN "roomId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DirectCallOccupancy" (
    "userId" UUID NOT NULL,
    "callId" UUID NOT NULL,

    CONSTRAINT "DirectCallOccupancy_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DirectCall" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stateSequence" INTEGER NOT NULL,
    "callerUserId" UUID NOT NULL,
    "calleeUserId" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RINGING',
    "credentialExpiresAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "endReason" VARCHAR(40),
    "callerHeartbeatAt" TIMESTAMPTZ(3),
    "calleeHeartbeatAt" TIMESTAMPTZ(3),
    "cleanupStatus" VARCHAR(20) NOT NULL DEFAULT 'NONE',
    "cleanupGeneration" INTEGER NOT NULL DEFAULT 0,
    "cleanupLeaseId" UUID,
    "cleanupLockedUntil" TIMESTAMPTZ(3),
    "cleanupAttempts" INTEGER NOT NULL DEFAULT 0,
    "cleanupNextAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DirectCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectCommand" (
    "actorUserId" UUID NOT NULL,
    "clientRequestId" UUID NOT NULL,
    "operation" VARCHAR(40) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectCommand_pkey" PRIMARY KEY ("actorUserId","clientRequestId")
);

-- CreateTable
CREATE TABLE "DirectConversationMember" (
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "hiddenThrough" INTEGER NOT NULL DEFAULT 0,
    "readThrough" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DirectConversationMember_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "DirectConversation" (
    "id" UUID NOT NULL,
    "userLowId" UUID NOT NULL,
    "userHighId" UUID NOT NULL,
    "initiatorUserId" UUID NOT NULL,
    "nextSequence" INTEGER NOT NULL DEFAULT 1,
    "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderUserId" UUID NOT NULL,
    "clientRequestId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedMaintenanceLease" (
    "key" VARCHAR(64) NOT NULL,
    "scanCursor" UUID,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "leaseId" UUID,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastCompletedAt" TIMESTAMPTZ(3),
    "lastSucceededAt" TIMESTAMPTZ(3),

    CONSTRAINT "ManagedMaintenanceLease_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProfileAvatar" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "image" BYTEA NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProfileAvatar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectCallOccupancy_callId_idx" ON "DirectCallOccupancy"("callId");

-- CreateIndex
CREATE INDEX "DirectCall_conversationId_stateSequence_idx" ON "DirectCall"("conversationId", "stateSequence");

-- CreateIndex
CREATE INDEX "DirectCall_callerUserId_status_createdAt_idx" ON "DirectCall"("callerUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DirectCall_calleeUserId_status_createdAt_idx" ON "DirectCall"("calleeUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DirectCall_status_expiresAt_idx" ON "DirectCall"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "DirectCall_cleanupStatus_cleanupNextAt_idx" ON "DirectCall"("cleanupStatus", "cleanupNextAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectCall_conversationId_sequence_key" ON "DirectCall"("conversationId", "sequence");

-- CreateIndex
CREATE INDEX "DirectConversationMember_userId_conversationId_idx" ON "DirectConversationMember"("userId", "conversationId");

-- CreateIndex
CREATE INDEX "DirectConversation_lastActivityAt_id_idx" ON "DirectConversation"("lastActivityAt", "id");

-- CreateIndex
CREATE INDEX "DirectConversation_initiatorUserId_createdAt_idx" ON "DirectConversation"("initiatorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_userLowId_userHighId_key" ON "DirectConversation"("userLowId", "userHighId");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_id_idx" ON "DirectMessage"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "DirectMessage_senderUserId_createdAt_idx" ON "DirectMessage"("senderUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessage_conversationId_sequence_key" ON "DirectMessage"("conversationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessage_senderUserId_clientRequestId_key" ON "DirectMessage"("senderUserId", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileAvatar_userId_key" ON "ProfileAvatar"("userId");

-- AddForeignKey
ALTER TABLE "DirectCallOccupancy" ADD CONSTRAINT "DirectCallOccupancy_callId_fkey" FOREIGN KEY ("callId") REFERENCES "DirectCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectCallOccupancy" ADD CONSTRAINT "DirectCallOccupancy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectCall" ADD CONSTRAINT "DirectCall_callerUserId_fkey" FOREIGN KEY ("callerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectCall" ADD CONSTRAINT "DirectCall_calleeUserId_fkey" FOREIGN KEY ("calleeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectCall" ADD CONSTRAINT "DirectCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectCommand" ADD CONSTRAINT "DirectCommand_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversationMember" ADD CONSTRAINT "DirectConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversationMember" ADD CONSTRAINT "DirectConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_initiatorUserId_fkey" FOREIGN KEY ("initiatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_userLowId_fkey" FOREIGN KEY ("userLowId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_userHighId_fkey" FOREIGN KEY ("userHighId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileAvatar" ADD CONSTRAINT "ProfileAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_directMessageId_fkey" FOREIGN KEY ("directMessageId") REFERENCES "DirectMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Context and sequence checks preserve independent private histories and report evidence.
ALTER TABLE "Report" ADD CONSTRAINT "Report_context_check" CHECK (("roomId" IS NOT NULL)::int + ("directMessageId" IS NOT NULL)::int = 1);
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_pair_check" CHECK ("userLowId" < "userHighId" AND "initiatorUserId" IN ("userLowId", "userHighId") AND "nextSequence" > 0);
ALTER TABLE "DirectConversationMember" ADD CONSTRAINT "DirectConversationMember_boundary_check" CHECK ("hiddenThrough" >= 0 AND "readThrough" >= "hiddenThrough");
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_text_check" CHECK (char_length(trim("text")) BETWEEN 1 AND 2000 AND "sequence" > 0);
ALTER TABLE "DirectCall" ADD CONSTRAINT "DirectCall_status_check" CHECK ("status" IN ('RINGING','ACTIVE','REJECTED','EXPIRED','ENDED'));
ALTER TABLE "DirectCall" ADD CONSTRAINT "DirectCall_participants_check" CHECK ("callerUserId" <> "calleeUserId" AND "sequence" > 0 AND "stateSequence" >= "sequence");
ALTER TABLE "DirectCall" ADD CONSTRAINT "DirectCall_cleanup_check" CHECK ("cleanupStatus" IN ('NONE','PENDING','DONE'));
ALTER TABLE "ProfileAvatar" ADD CONSTRAINT "ProfileAvatar_size_check" CHECK (octet_length("image") BETWEEN 1 AND 262144);
