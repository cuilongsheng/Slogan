CREATE TABLE "LiveUpdateOutbox" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scope" VARCHAR(16) NOT NULL CHECK ("scope" IN ('rooms','partners','messages')),
  "ownerId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CHECK (("scope" = 'messages') = ("ownerId" IS NOT NULL))
);
CREATE INDEX "LiveUpdateOutbox_createdAt_id_idx" ON "LiveUpdateOutbox"("createdAt","id");

-- Transactional triggers also cover workers, recovery, and older compatible writers.
CREATE FUNCTION slogan_live_enqueue(s text, u uuid DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
 INSERT INTO "LiveUpdateOutbox" ("scope","ownerId") VALUES(s,u);
$$;
CREATE FUNCTION slogan_live_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE body jsonb; previous jsonb; owner uuid; changed_owner uuid; conversation uuid;
BEGIN
 IF TG_OP='DELETE' THEN body:=to_jsonb(OLD); ELSE body:=to_jsonb(NEW); END IF;
 IF TG_OP='UPDATE' THEN
   previous:=to_jsonb(OLD);
   IF TG_TABLE_NAME='DirectCall' AND body->>'stateSequence'=previous->>'stateSequence' THEN RETURN NEW; END IF;
   IF TG_TABLE_NAME='RoomMembership' AND body->>'lifecycle'=previous->>'lifecycle' AND body->>'role'=previous->>'role' THEN RETURN NEW; END IF;
   IF TG_TABLE_NAME='DirectConversationMember' AND body=previous THEN RETURN NEW; END IF;
 END IF;
 IF TG_TABLE_NAME IN ('DirectConversationMember','DirectMessage','DirectCall','DirectConversation') THEN
   IF TG_TABLE_NAME='DirectConversationMember' THEN
     PERFORM slogan_live_enqueue('messages',(body->>'userId')::uuid);
   ELSE
     IF TG_TABLE_NAME='DirectConversation' THEN conversation:=(body->>'id')::uuid;
     ELSE conversation:=(body->>'conversationId')::uuid; END IF;
     FOR owner IN SELECT "userId" FROM "DirectConversationMember" WHERE "conversationId"=conversation LOOP
       PERFORM slogan_live_enqueue('messages',owner);
     END LOOP;
   END IF;
 END IF;
 IF TG_TABLE_NAME NOT IN ('DirectMessage','DirectConversationMember','DirectConversation') THEN
   PERFORM slogan_live_enqueue('partners');
 END IF;
 IF TG_TABLE_NAME IN ('Room','RoomMembership','UserProfile','User','SafetyRestriction') THEN
   PERFORM slogan_live_enqueue('rooms');
 END IF;
 IF TG_TABLE_NAME IN ('UserProfile','User','SafetyRestriction') THEN
   IF TG_TABLE_NAME='User' THEN owner:=(body->>'id')::uuid; ELSE owner:=(body->>'userId')::uuid; END IF;
   changed_owner:=owner;
   PERFORM slogan_live_enqueue('messages',owner);
   FOR owner IN SELECT DISTINCT peer."userId" FROM "DirectConversationMember" own
     JOIN "DirectConversationMember" peer ON peer."conversationId"=own."conversationId"
     WHERE own."userId"=changed_owner LOOP
     PERFORM slogan_live_enqueue('messages',owner);
   END LOOP;
 END IF;
 IF TG_TABLE_NAME='UserBlock' THEN
   PERFORM slogan_live_enqueue('messages',(body->>'blockerUserId')::uuid);
   PERFORM slogan_live_enqueue('messages',(body->>'blockedUserId')::uuid);
 END IF;
 RETURN NULL;
END;
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['Room','RoomMembership','UserProfile','User','SafetyRestriction','UserBlock','DirectConversation','DirectConversationMember','DirectMessage','DirectCall','DirectCallOccupancy'] LOOP
   EXECUTE format('CREATE TRIGGER slogan_live_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION slogan_live_change()',t);
 END LOOP;
END $$;
