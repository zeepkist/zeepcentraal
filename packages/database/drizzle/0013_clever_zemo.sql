DO $$
BEGIN
  -- Add UQ_favourites_user_level if not exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UQ_favourites_user_level'
  ) THEN
    ALTER TABLE "favourite"
    ADD CONSTRAINT "UQ_favourites_user_level" UNIQUE("id_user", "id_level");
  END IF;

  -- Add UQ_personal_bests_user_level if not exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UQ_personal_bests_user_level'
  ) THEN
    ALTER TABLE "personal_best_global"
    ADD CONSTRAINT "UQ_personal_bests_user_level" UNIQUE("id_user", "id_level");
  END IF;

  -- Add UQ_user_points_user if not exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UQ_user_points_user'
  ) THEN
    ALTER TABLE "user_points"
    ADD CONSTRAINT "UQ_user_points_user" UNIQUE("id_user");
  END IF;

  -- Add UQ_world_records_level if not exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UQ_world_records_level'
  ) THEN
    ALTER TABLE "world_record_global"
    ADD CONSTRAINT "UQ_world_records_level" UNIQUE("id_level");
  END IF;
END$$;
