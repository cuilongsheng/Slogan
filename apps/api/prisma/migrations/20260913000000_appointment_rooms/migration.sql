CREATE TYPE "RoomKind" AS ENUM ('INSTANT', 'APPOINTMENT');
CREATE TYPE "ReservationStatus" AS ENUM ('BOOKED', 'CANCELLED', 'CONSUMED', 'EXPIRED');
ALTER TYPE "RoomStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "RoomStatus" ADD VALUE 'CANCELLED';
ALTER TABLE "Room"
  ADD COLUMN "kind" "RoomKind" NOT NULL DEFAULT 'INSTANT',
  ADD COLUMN "initialHostDeadline" TIMESTAMPTZ(3),
  ADD COLUMN "initialHostResolved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cancelledAt" TIMESTAMPTZ(3),
  ADD COLUMN "cancelledReason" VARCHAR(64),
  ADD CONSTRAINT "Room_appointment_deadline_check" CHECK (
    "kind" <> 'APPOINTMENT' OR (
      "initialHostDeadline" IS NOT NULL AND "initialHostDeadline" = "startedAt" + INTERVAL '5 minutes'
      AND "endsAt" > "startedAt"
    )
  );
CREATE TABLE "RoomReservation" (
  "id" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'BOOKED',
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "bookedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt" TIMESTAMPTZ(3),
  "consumedAt" TIMESTAMPTZ(3),
  CONSTRAINT "RoomReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoomReservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RoomReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RoomReservation_roomId_userId_key" ON "RoomReservation"("roomId", "userId");
CREATE INDEX "RoomReservation_roomId_status_idx" ON "RoomReservation"("roomId", "status");
