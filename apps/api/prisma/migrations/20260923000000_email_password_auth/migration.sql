-- CreateEnum
CREATE TYPE "EmailEnrollmentPurpose" AS ENUM ('REGISTER', 'LINK');

-- CreateEnum
CREATE TYPE "EmailChallengePurpose" AS ENUM ('REGISTER', 'LINK', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "EmailProofPurpose" AS ENUM ('LINK_EMAIL', 'ACCOUNT_DELETE');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'RUNNING', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmailAuthProof" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "commandId" UUID NOT NULL,
    "purpose" "EmailProofPurpose" NOT NULL,
    "tokenDigest" VARCHAR(128) NOT NULL,
    "credentialVersion" INTEGER,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAuthProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailChallenge" (
    "id" UUID NOT NULL,
    "purpose" "EmailChallengePurpose" NOT NULL,
    "enrollmentId" UUID,
    "userId" UUID,
    "tokenDigest" VARCHAR(128) NOT NULL,
    "generation" INTEGER NOT NULL,
    "credentialVersion" INTEGER,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCredential" (
    "userId" UUID NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(512),
    "credentialVersion" INTEGER NOT NULL DEFAULT 1,
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmailCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "encryptedPayload" TEXT,
    "keyId" VARCHAR(32) NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMPTZ(3),
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL,
    "terminalAt" TIMESTAMPTZ(3),
    "resultCode" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEnrollment" (
    "id" UUID NOT NULL,
    "purpose" "EmailEnrollmentPurpose" NOT NULL,
    "userId" UUID,
    "sessionId" UUID,
    "commandId" UUID,
    "payloadHash" VARCHAR(64),
    "username" VARCHAR(20),
    "email" VARCHAR(254),
    "passwordHash" VARCHAR(512),
    "managementDigest" VARCHAR(128),
    "generation" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailAuthProof_tokenDigest_key" ON "EmailAuthProof"("tokenDigest");

-- CreateIndex
CREATE INDEX "EmailAuthProof_userId_purpose_idx" ON "EmailAuthProof"("userId", "purpose");

-- CreateIndex
CREATE INDEX "EmailAuthProof_expiresAt_idx" ON "EmailAuthProof"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChallenge_tokenDigest_key" ON "EmailChallenge"("tokenDigest");

-- CreateIndex
CREATE INDEX "EmailChallenge_userId_purpose_idx" ON "EmailChallenge"("userId", "purpose");

-- CreateIndex
CREATE INDEX "EmailChallenge_expiresAt_idx" ON "EmailChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCredential_username_key" ON "EmailCredential"("username");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCredential_email_key" ON "EmailCredential"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_challengeId_key" ON "EmailDelivery"("challengeId");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_leaseUntil_idx" ON "EmailDelivery"("leaseUntil");

-- CreateIndex
CREATE INDEX "EmailDelivery_terminalAt_idx" ON "EmailDelivery"("terminalAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailEnrollment_managementDigest_key" ON "EmailEnrollment"("managementDigest");

-- CreateIndex
CREATE INDEX "EmailEnrollment_username_expiresAt_idx" ON "EmailEnrollment"("username", "expiresAt");

-- CreateIndex
CREATE INDEX "EmailEnrollment_email_expiresAt_idx" ON "EmailEnrollment"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "EmailEnrollment_expiresAt_idx" ON "EmailEnrollment"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailEnrollment_userId_commandId_key" ON "EmailEnrollment"("userId", "commandId");

-- AddForeignKey
ALTER TABLE "EmailChallenge" ADD CONSTRAINT "EmailChallenge_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "EmailEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCredential" ADD CONSTRAINT "EmailCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "EmailChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
