DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UQ_level_points_level'
      AND conrelid = 'level_points'::regclass
  ) THEN
    ALTER TABLE "level_points" DROP CONSTRAINT "UQ_level_points_level";
  END IF;
END$$;
