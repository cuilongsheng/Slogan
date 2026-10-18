CREATE TABLE "MetricSourceVersion" ("transactionId" BIGINT PRIMARY KEY);
ALTER TABLE "MetricComputationRun" ADD COLUMN "sourceVersion" BIGINT, ADD COLUMN "maturityComplete" BOOLEAN NOT NULL DEFAULT false;
-- Captured before computation; concurrent/late mutations cannot be marked as already computed.
CREATE FUNCTION bump_metric_source_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN RETURN NULL; END IF;
 INSERT INTO "MetricSourceVersion" ("transactionId") VALUES (txid_current()) ON CONFLICT DO NOTHING;
 RETURN NULL;
END $$;
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "User" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "UserProfile" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "RoomMembership" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "RoomEvent" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "Room" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "AiExpressionRequest" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "VocabularyItem" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "RoomShareAttribution" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "RoomReservation" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "SafetyCase" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
CREATE TRIGGER metric_source_version AFTER INSERT OR UPDATE OR DELETE ON "Report" FOR EACH ROW EXECUTE FUNCTION bump_metric_source_version();
