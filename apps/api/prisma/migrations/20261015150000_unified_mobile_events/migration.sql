-- Additive protocol2 envelope. Legacy scopes and their original triggers remain intact.
ALTER TABLE "LiveUpdateOutbox" DROP CONSTRAINT "LiveUpdateOutbox_scope_check", DROP CONSTRAINT "LiveUpdateOutbox_check";
ALTER TABLE "LiveUpdateOutbox" ALTER COLUMN scope TYPE VARCHAR(32), ADD COLUMN "resourceId" UUID, ADD COLUMN kind VARCHAR(24);
ALTER TABLE "LiveUpdateOutbox" ADD CONSTRAINT "LiveUpdateOutbox_scope_check" CHECK (scope IN (
 'rooms','partners','messages','conversation-history','conversation-state','inbox','unread','calls','invitations','room-state','room-text','room-safety','account','safety','reports','learning','release'));
ALTER TABLE "LiveUpdateOutbox" ADD CONSTRAINT "LiveUpdateOutbox_audience_check" CHECK (
 (scope IN ('rooms','partners','release') AND "ownerId" IS NULL AND "resourceId" IS NULL) OR
 (scope NOT IN ('rooms','partners','release') AND "ownerId" IS NOT NULL));

CREATE FUNCTION slogan_live_v2_enqueue(s text, u uuid, r uuid DEFAULT NULL, k text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
 INSERT INTO "LiveUpdateOutbox" (scope,"ownerId","resourceId",kind) VALUES(s,u,r,k);
$$;
CREATE FUNCTION slogan_live_v2_room(s text, r uuid, k text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
 INSERT INTO "LiveUpdateOutbox" (scope,"ownerId","resourceId",kind)
 SELECT s,"userId",r,k FROM "RoomMembership" WHERE "roomId"=r AND lifecycle='ACTIVE';
$$;
CREATE FUNCTION slogan_live_v2_conversation(s text, c uuid) RETURNS void LANGUAGE sql AS $$
 INSERT INTO "LiveUpdateOutbox" (scope,"ownerId","resourceId")
 SELECT s,"userId",c FROM "DirectConversationMember" WHERE "conversationId"=c;
$$;
CREATE FUNCTION slogan_live_v2_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b jsonb; p jsonb; u uuid; r uuid; c uuid; peer uuid; owner uuid; item record;
BEGIN
 IF TG_OP='DELETE' THEN b:=to_jsonb(OLD); ELSE b:=to_jsonb(NEW); END IF;
 IF TG_OP='UPDATE' THEN
   p:=to_jsonb(OLD);
   IF b - 'updatedAt' = p - 'updatedAt' THEN RETURN NULL; END IF;
 END IF;
 IF TG_TABLE_NAME='DirectMessage' THEN
   c:=(b->>'conversationId')::uuid;
   PERFORM slogan_live_v2_conversation('conversation-history',c);
   PERFORM slogan_live_v2_conversation('inbox',c);
   PERFORM slogan_live_v2_conversation('unread',c);
 ELSIF TG_TABLE_NAME='DirectCall' THEN
   IF TG_OP='UPDATE' AND b->>'stateSequence'=p->>'stateSequence' THEN RETURN NULL; END IF;
   c:=(b->>'conversationId')::uuid;
   PERFORM slogan_live_v2_conversation('conversation-history',c);
   PERFORM slogan_live_v2_conversation('inbox',c);
   PERFORM slogan_live_v2_enqueue('calls',(b->>'callerUserId')::uuid,(b->>'id')::uuid);
   PERFORM slogan_live_v2_enqueue('calls',(b->>'calleeUserId')::uuid,(b->>'id')::uuid);
 ELSIF TG_TABLE_NAME='DirectConversationMember' THEN
   u:=(b->>'userId')::uuid; c:=(b->>'conversationId')::uuid;
   IF TG_OP<>'UPDATE' OR b->>'hiddenThrough' IS DISTINCT FROM p->>'hiddenThrough' THEN
     PERFORM slogan_live_v2_enqueue('conversation-history',u,c,'visibility');
     PERFORM slogan_live_v2_enqueue('conversation-state',u,c);
   END IF;
   IF TG_OP<>'UPDATE' OR b->>'hiddenThrough' IS DISTINCT FROM p->>'hiddenThrough' OR b->>'readThrough' IS DISTINCT FROM p->>'readThrough' THEN
     PERFORM slogan_live_v2_enqueue('inbox',u,c);
     PERFORM slogan_live_v2_enqueue('unread',u,c);
   END IF;
 ELSIF TG_TABLE_NAME IN ('User','UserProfile','SafetyRestriction','SafetyAppeal','SpeechProcessingConsentEvent') THEN
   IF TG_TABLE_NAME='User' THEN u:=(b->>'id')::uuid; ELSE u:=(b->>'userId')::uuid; END IF;
   IF TG_TABLE_NAME IN ('SafetyRestriction','SafetyAppeal') THEN
     PERFORM slogan_live_v2_enqueue('safety',u);
   ELSE
     PERFORM slogan_live_v2_enqueue('account',u);
   END IF;
   IF TG_TABLE_NAME IN ('User','UserProfile','SafetyRestriction') THEN
     FOR c IN SELECT "conversationId" FROM "DirectConversationMember" WHERE "userId"=u LOOP
       PERFORM slogan_live_v2_conversation('conversation-state',c);
       PERFORM slogan_live_v2_conversation('inbox',c);
     END LOOP;
     FOR item IN SELECT DISTINCT i."roomId",i."inviteeUserId",room."hostUserId" FROM "RoomInvitation" i JOIN "Room" room ON room.id=i."roomId"
       WHERE i.status='PENDING' AND (i."inviteeUserId"=u OR i."inviterUserId"=u OR room."hostUserId"=u) LOOP
       PERFORM slogan_live_v2_enqueue('invitations',item."inviteeUserId",item."roomId");
       PERFORM slogan_live_v2_enqueue('invitations',item."hostUserId",item."roomId");
     END LOOP;
   END IF;
   IF TG_TABLE_NAME='SpeechProcessingConsentEvent' THEN
     FOR r IN SELECT "roomId" FROM "RoomMembership" WHERE "userId"=u AND lifecycle='ACTIVE' LOOP
       PERFORM slogan_live_v2_room('room-state',r);
     END LOOP;
   END IF;
 ELSIF TG_TABLE_NAME='UserBlock' THEN
   u:=(b->>'blockerUserId')::uuid; peer:=(b->>'blockedUserId')::uuid;
   FOR c IN SELECT "id" FROM "DirectConversation" WHERE ("userLowId"=u AND "userHighId"=peer) OR ("userLowId"=peer AND "userHighId"=u) LOOP
     PERFORM slogan_live_v2_conversation('conversation-state',c);
     PERFORM slogan_live_v2_conversation('inbox',c);
   END LOOP;
   FOR item IN SELECT DISTINCT i."roomId",i."inviteeUserId",room."hostUserId" FROM "RoomInvitation" i JOIN "Room" room ON room.id=i."roomId"
     WHERE i.status='PENDING' AND ((i."inviteeUserId"=u AND room."hostUserId"=peer) OR (i."inviteeUserId"=peer AND room."hostUserId"=u)) LOOP
     PERFORM slogan_live_v2_enqueue('invitations',item."inviteeUserId",item."roomId");
     PERFORM slogan_live_v2_enqueue('invitations',item."hostUserId",item."roomId");
   END LOOP;
 ELSIF TG_TABLE_NAME='RoomInvitation' THEN
   r:=(b->>'roomId')::uuid;
   PERFORM slogan_live_v2_enqueue('invitations',(b->>'inviteeUserId')::uuid,r);
   SELECT "hostUserId" INTO u FROM "Room" WHERE id=r;
   IF u IS NOT NULL THEN PERFORM slogan_live_v2_enqueue('invitations',u,r); END IF;
 ELSIF TG_TABLE_NAME IN ('Room','RoomMembership','RoomTimeExtension','RoomReservation') THEN
   IF TG_TABLE_NAME='Room' THEN r:=(b->>'id')::uuid; ELSE r:=(b->>'roomId')::uuid; END IF;
   IF TG_TABLE_NAME='RoomMembership' THEN
     IF TG_OP='UPDATE' AND b->>'lifecycle'=p->>'lifecycle' AND b->>'role'=p->>'role' AND b->>'presence'=p->>'presence' AND b->>'credentialVersion'=p->>'credentialVersion' THEN RETURN NULL; END IF;
     PERFORM slogan_live_v2_enqueue('room-state',(b->>'userId')::uuid,r,'membership');
     PERFORM slogan_live_v2_enqueue('learning',(b->>'userId')::uuid);
   ELSIF TG_TABLE_NAME='RoomReservation' THEN
     PERFORM slogan_live_v2_enqueue('learning',(b->>'userId')::uuid);
   END IF;
   PERFORM slogan_live_v2_room('room-state',r);
   FOR u IN SELECT DISTINCT "inviteeUserId" FROM "RoomInvitation" WHERE "roomId"=r AND status='PENDING' LOOP
     PERFORM slogan_live_v2_enqueue('invitations',u,r);
   END LOOP;
   IF TG_TABLE_NAME='Room' THEN
     FOR u IN SELECT DISTINCT "userId" FROM "RoomMembership" WHERE "roomId"=r LOOP
       PERFORM slogan_live_v2_enqueue('learning',u);
     END LOOP;
   END IF;
 ELSIF TG_TABLE_NAME='RoomTextMessage' THEN
   PERFORM slogan_live_v2_room('room-text',(b->>'roomId')::uuid);
 ELSIF TG_TABLE_NAME IN ('RoomSpeechRiskEvent','RoomSpeechAlertDelivery') THEN
   IF TG_TABLE_NAME='RoomSpeechRiskEvent' THEN r:=(b->>'roomId')::uuid;
   ELSE
     IF TG_OP='UPDATE' AND b->>'status'=p->>'status' THEN RETURN NULL; END IF;
     SELECT "roomId" INTO r FROM "RoomSpeechRiskEvent" WHERE id=(b->>'riskEventId')::uuid;
   END IF;
   SELECT "hostUserId" INTO u FROM "Room" WHERE id=r AND "sensitiveSpeechDetectionEnabled"=true;
   IF u IS NOT NULL THEN PERFORM slogan_live_v2_enqueue('room-safety',u,r); END IF;
 ELSIF TG_TABLE_NAME IN ('Report','SafetyCase') THEN
   IF TG_TABLE_NAME='Report' THEN u:=(b->>'reporterUserId')::uuid;
   ELSE
     IF TG_OP='UPDATE' AND b->>'status'=p->>'status' AND b->>'decidedAt' IS NOT DISTINCT FROM p->>'decidedAt' THEN RETURN NULL; END IF;
     SELECT "reporterUserId" INTO u FROM "Report" WHERE id=(b->>'reportId')::uuid;
   END IF;
   IF u IS NOT NULL THEN PERFORM slogan_live_v2_enqueue('reports',u); END IF;
 ELSIF TG_TABLE_NAME IN ('RoomNote','VocabularyItem') THEN
   PERFORM slogan_live_v2_enqueue('learning',(b->>'userId')::uuid);
 ELSIF TG_TABLE_NAME='RoomKeywordSummary' THEN
   IF TG_OP='UPDATE' AND b->>'status'=p->>'status' AND b->>'version'=p->>'version' THEN RETURN NULL; END IF;
   r:=(b->>'roomId')::uuid;
   FOR u IN SELECT DISTINCT "userId" FROM "RoomMembership" WHERE "roomId"=r LOOP
     PERFORM slogan_live_v2_enqueue('learning',u);
   END LOOP;
 END IF;
 RETURN NULL;
END;
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['DirectMessage','DirectCall','DirectConversationMember','User','UserProfile','UserBlock','SafetyRestriction','SafetyAppeal','SpeechProcessingConsentEvent','RoomInvitation','Room','RoomMembership','RoomReservation','RoomTimeExtension','RoomTextMessage','RoomSpeechRiskEvent','RoomSpeechAlertDelivery','Report','SafetyCase','RoomNote','VocabularyItem','RoomKeywordSummary'] LOOP
   EXECUTE format('CREATE TRIGGER slogan_live_v2_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION slogan_live_v2_change()',t);
 END LOOP;
END $$;
