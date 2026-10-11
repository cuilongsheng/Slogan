ALTER TYPE "BackofficeRole" ADD VALUE 'PUBLIC_TRIAL_VIEWER';
ALTER TYPE "PasswordCredentialOrigin" ADD VALUE 'PUBLIC_TRIAL_PROVISIONED';
CREATE TABLE "PublicTrialAccount" (
  "userId" UUID NOT NULL,
  "environmentId" VARCHAR(64) NOT NULL,
  "username" VARCHAR(20) NOT NULL,
  "disabledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicTrialAccount_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "PublicTrialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PublicTrialAccount_environmentId_username_key" ON "PublicTrialAccount"("environmentId", "username");
