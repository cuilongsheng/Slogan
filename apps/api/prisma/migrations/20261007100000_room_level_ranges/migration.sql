ALTER TABLE "Room" ADD COLUMN "cefrLevelMin" "CefrLevel", ADD COLUMN "cefrLevelMax" "CefrLevel";
UPDATE "Room" SET "cefrLevelMin" = split_part("cefrLevel"::text, '_', 1)::"CefrLevel", "cefrLevelMax" = reverse(split_part(reverse("cefrLevel"::text), '_', 1))::"CefrLevel";
ALTER TABLE "Room" ADD CONSTRAINT "Room_cefr_range_check" CHECK (
 "cefrLevelMin" IS NULL AND "cefrLevelMax" IS NULL OR
 "cefrLevelMin" IS NOT NULL AND "cefrLevelMax" IS NOT NULL AND
 array_position(ARRAY['A1','A2','B1','B2','C1','C2'], "cefrLevelMin"::text) IS NOT NULL AND
 array_position(ARRAY['A1','A2','B1','B2','C1','C2'], "cefrLevelMin"::text) <= array_position(ARRAY['A1','A2','B1','B2','C1','C2'], "cefrLevelMax"::text)
);
