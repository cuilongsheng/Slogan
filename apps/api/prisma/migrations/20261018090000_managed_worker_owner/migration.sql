CREATE TABLE "ManagedWorkerOwner" (
  "key" VARCHAR(64) PRIMARY KEY,
  "deploymentId" VARCHAR(128) NOT NULL,
  "generation" INTEGER NOT NULL CHECK ("generation" > 0),
  "activatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
