-- Each in-flight request owns its lease. Successful requests release it immediately.
CREATE TABLE "RealtimeIssuance" (
  "id" UUID NOT NULL,
  "identity" UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RealtimeIssuance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RealtimeIssuance_identity_fkey" FOREIGN KEY ("identity") REFERENCES "RealtimeIdentity"("identity") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RealtimeIssuance_identity_expiresAt_idx" ON "RealtimeIssuance"("identity", "expiresAt");
