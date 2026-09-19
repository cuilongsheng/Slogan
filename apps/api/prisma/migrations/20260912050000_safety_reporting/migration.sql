CREATE TYPE "ReportCategory" AS ENUM ('HARASSMENT_ABUSE', 'HATE_DISCRIMINATION', 'SEXUAL_CONTENT', 'SPAM_ADVERTISING', 'OTHER');
CREATE TABLE "Report" (
 "id" UUID PRIMARY KEY,
 "roomId" UUID NOT NULL,
 "reporterUserId" UUID NOT NULL,
 "targetUserId" UUID NOT NULL,
 "clientRequestId" UUID NOT NULL,
 "category" "ReportCategory" NOT NULL,
 "description" TEXT NOT NULL,
 "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Report_description_length" CHECK (char_length("description") BETWEEN 1 AND 2000),
 CONSTRAINT "Report_not_self" CHECK ("reporterUserId" <> "targetUserId"),
 CONSTRAINT "Report_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Report_roomId_reporterUserId_fkey" FOREIGN KEY ("roomId", "reporterUserId") REFERENCES "RoomMembership"("roomId", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "Report_roomId_targetUserId_fkey" FOREIGN KEY ("roomId", "targetUserId") REFERENCES "RoomMembership"("roomId", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "Report_reporterUserId_clientRequestId_key" ON "Report"("reporterUserId", "clientRequestId");
CREATE INDEX "Report_roomId_submittedAt_id_idx" ON "Report"("roomId", "submittedAt", "id");
ALTER TABLE "RoomEvent" ADD COLUMN "reportId" UUID;
CREATE UNIQUE INDEX "RoomEvent_reportId_key" ON "RoomEvent"("reportId");
ALTER TABLE "RoomEvent" ADD CONSTRAINT "RoomEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomEvent" ADD CONSTRAINT "RoomEvent_report_required" CHECK (
 ("type" = 'report_submitted' AND "reportId" IS NOT NULL AND "roomId" IS NOT NULL AND "actorId" IS NOT NULL AND "targetId" IS NOT NULL AND "reason" IS NOT NULL AND "result" = 'SUBMITTED')
 OR ("type" <> 'report_submitted' AND "reportId" IS NULL)
);
