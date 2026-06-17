-- Step 1: Add id_user column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'world_record_global'
          AND column_name = 'id_user'
    ) THEN
        ALTER TABLE "world_record_global" ADD COLUMN "id_user" INTEGER;
    END IF;
END$$;

-- Step 2: Backfill id_user from record table
-- (safe to re-run; won't overwrite existing non-null values)
UPDATE "world_record_global" wrg
SET "id_user" = r."id_user"
FROM "record" r
WHERE wrg."id_record" = r."id"
  AND wrg."id_user" IS NULL;

-- Step 3: Add NOT NULL constraint only if no NULLs exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "world_record_global"
        WHERE "id_user" IS NULL
    ) THEN
        ALTER TABLE "world_record_global" ALTER COLUMN "id_user" SET NOT NULL;
    END IF;
END$$;

-- Step 4: Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'world_records_global_user_fkey'
    ) THEN
        ALTER TABLE "world_record_global"
        ADD CONSTRAINT "world_records_global_user_fkey"
        FOREIGN KEY ("id_user") REFERENCES "public"."user"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END$$;

-- Step 5: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "IX_world_records_user"
ON "world_record_global" USING btree ("id_user");

CREATE INDEX IF NOT EXISTS "IX_world_records_level"
ON "world_record_global" USING btree ("id_level");
