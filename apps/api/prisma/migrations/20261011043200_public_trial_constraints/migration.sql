ALTER TABLE "EmailCredential" DROP CONSTRAINT "EmailCredential_origin_verification_check";
ALTER TABLE "EmailCredential" ADD CONSTRAINT "EmailCredential_origin_verification_check" CHECK (
  ("origin" = 'EMAIL_VERIFIED' AND "verifiedAt" IS NOT NULL) OR
  ("origin" IN ('PREVIEW_PROVISIONED', 'PUBLIC_TRIAL_PROVISIONED') AND "verifiedAt" IS NULL)
);
ALTER TABLE "BackofficeRoleAssignment" DROP CONSTRAINT "BackofficeRoleAssignment_revoke_pair_check";
ALTER TABLE "BackofficeRoleAssignment" ADD CONSTRAINT "BackofficeRoleAssignment_revoke_pair_check" CHECK (
  ("revokedAt" IS NULL) = ("revokedByUserId" IS NULL) OR
  ("role" = 'PUBLIC_TRIAL_VIEWER' AND "revokedAt" IS NOT NULL AND "revokedByUserId" IS NULL)
);
