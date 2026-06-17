DO $$
BEGIN
  -- Drop UNIQUE constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UQ_user_points_user'
      AND conrelid = 'user_points'::regclass
  ) THEN
    ALTER TABLE "user_points" DROP CONSTRAINT "UQ_user_points_user";
  END IF;

  -- Drop index if it exists
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'IX_player_points_user'
      AND n.nspname = 'public'
  ) THEN
    DROP INDEX "IX_player_points_user";
  END IF;

  -- Create unique index if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'UQ_player_points_user'
      AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX "UQ_player_points_user" ON "user_points" USING btree ("id_user");
  END IF;
END$$;
