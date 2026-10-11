ALTER TABLE "UserProfile"
  ALTER COLUMN "genderCode" DROP NOT NULL,
  ALTER COLUMN "birthYear" DROP NOT NULL,
  ALTER COLUMN "birthMonth" DROP NOT NULL,
  ADD COLUMN "adultConfirmedAt" TIMESTAMPTZ(3);
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_birth_pair_check"
  CHECK (("birthYear" IS NULL) = ("birthMonth" IS NULL));
