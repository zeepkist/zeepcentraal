DO $$
BEGIN
  -- Create IX_records_user_level_time if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'IX_records_user_level_time'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX "IX_records_user_level_time" ON "record" USING btree ("id_user", "id_level", "time");
  END IF;

  -- Create IX_records_user_level_date_created if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'IX_records_user_level_date_created'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX "IX_records_user_level_date_created" ON "record" USING btree ("id_user", "id_level", "date_created");
  END IF;

  -- Create IX_world_records_user_level_record if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'IX_world_records_user_level_record'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX "IX_world_records_user_level_record" ON "world_record_global" USING btree ("id_user", "id_level", "id_record");
  END IF;
END$$;
