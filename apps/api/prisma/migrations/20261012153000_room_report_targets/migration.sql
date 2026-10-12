-- Preserve all existing member/message targets. Room reports have no accused user.
ALTER TABLE "Report" ALTER COLUMN "targetUserId" DROP NOT NULL;
ALTER TABLE "SafetyCase" ALTER COLUMN "targetUserId" DROP NOT NULL;
ALTER TABLE "Report" ADD CONSTRAINT "Report_room_target_check"
  CHECK ("targetUserId" IS NOT NULL OR "directMessageId" IS NULL);
