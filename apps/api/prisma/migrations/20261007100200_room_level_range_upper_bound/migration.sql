ALTER TABLE "Room" ADD CONSTRAINT "Room_cefr_range_upper_bound_check" CHECK (
 "cefrLevelMax" IS NULL OR "cefrLevelMax"::text IN ('A1','A2','B1','B2','C1','C2')
);
