CREATE TYPE "PasswordCredentialOrigin" AS ENUM ('EMAIL_VERIFIED', 'PREVIEW_PROVISIONED');
CREATE TYPE "PreviewAccountSlot" AS ENUM ('ADMIN', 'SAFETY', 'MOBILE_A', 'MOBILE_B', 'MOBILE_C');
ALTER TABLE "EmailCredential" ADD COLUMN "origin" "PasswordCredentialOrigin" NOT NULL DEFAULT 'EMAIL_VERIFIED';
ALTER TABLE "EmailCredential" ALTER COLUMN "verifiedAt" DROP NOT NULL;
ALTER TABLE "EmailCredential" ADD CONSTRAINT "EmailCredential_origin_verification_check" CHECK
 (("origin" = 'EMAIL_VERIFIED' AND "verifiedAt" IS NOT NULL) OR
  ("origin" = 'PREVIEW_PROVISIONED' AND "verifiedAt" IS NULL));
CREATE TABLE "PreviewAccountProvisioning" (
 "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "environmentId" VARCHAR(64) NOT NULL, "slot" "PreviewAccountSlot" NOT NULL,
 "batchId" UUID NOT NULL, "grantCommandId" UUID NOT NULL UNIQUE, "revokeCommandId" UUID NOT NULL UNIQUE,
 "rolesCompletedAt" TIMESTAMPTZ(3), "retiredAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("environmentId", "slot")
);
