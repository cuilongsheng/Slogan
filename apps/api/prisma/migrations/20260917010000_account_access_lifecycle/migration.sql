CREATE TYPE "AccountLifecycleAction" AS ENUM ('DELETE_ACCOUNT');
CREATE TYPE "AccountLifecycleCommandStatus" AS ENUM ('COMPLETED');

ALTER TABLE "User"
ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

CREATE TABLE "PhoneIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phoneLookupVersion" VARCHAR(32) NOT NULL,
    "phoneLookupHash" CHAR(64) NOT NULL,
    "countryCallingCode" VARCHAR(4) NOT NULL,
    "lastTwo" CHAR(2) NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "PhoneIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountLifecycleCommand" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" "AccountLifecycleAction" NOT NULL,
    "status" "AccountLifecycleCommandStatus" NOT NULL DEFAULT 'COMPLETED',
    "clientRequestId" UUID NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountLifecycleCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhoneIdentity_userId_key" ON "PhoneIdentity"("userId");
CREATE UNIQUE INDEX "PhoneIdentity_phoneLookupVersion_phoneLookupHash_key"
ON "PhoneIdentity"("phoneLookupVersion", "phoneLookupHash");
CREATE INDEX "PhoneIdentity_userId_idx" ON "PhoneIdentity"("userId");
CREATE UNIQUE INDEX "OAuthIdentity_userId_provider_key" ON "OAuthIdentity"("userId", "provider");
CREATE UNIQUE INDEX "AccountLifecycleCommand_userId_clientRequestId_key"
ON "AccountLifecycleCommand"("userId", "clientRequestId");
CREATE INDEX "AccountLifecycleCommand_status_createdAt_idx"
ON "AccountLifecycleCommand"("status", "createdAt");

ALTER TABLE "PhoneIdentity"
ADD CONSTRAINT "PhoneIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountLifecycleCommand"
ADD CONSTRAINT "AccountLifecycleCommand_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
