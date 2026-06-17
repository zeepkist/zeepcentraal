DO $$
BEGIN
  IF to_regclass('public.favorite') IS NOT NULL THEN
    -- Rename the table
    ALTER TABLE "favorite" RENAME TO "favourite";

    -- Drop old constraints
    ALTER TABLE "favourite" DROP CONSTRAINT IF EXISTS "favorite_level_fkey";
    ALTER TABLE "favourite" DROP CONSTRAINT IF EXISTS "favorites_user_foreign";

    -- Add new constraints
    ALTER TABLE "favourite" ADD CONSTRAINT "favorite_level_fkey"
      FOREIGN KEY ("id_level") REFERENCES "public"."level"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;

    ALTER TABLE "favourite" ADD CONSTRAINT "favorites_user_foreign"
      FOREIGN KEY ("id_user") REFERENCES "public"."user"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
