ALTER TABLE "auth" ADD COLUMN "refresh_token_hash" text;--> statement-breakpoint
DELETE FROM "auth";--> statement-breakpoint
UPDATE "user"
SET "discord_id" = -1
WHERE "discord_id" = 9223372036854775807;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "user"
		WHERE "steam_id" IS NOT NULL
		GROUP BY "steam_id"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot add UQ_user_steam_id: duplicate Steam identities require manual resolution';
	END IF;
	IF EXISTS (
		SELECT 1 FROM "user"
		WHERE "discord_id" > 0
		GROUP BY "discord_id"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot add UQ_user_discord_id: duplicate Discord identities require manual resolution';
	END IF;
END $$;--> statement-breakpoint
DELETE FROM "vote" older
USING "vote" newer
WHERE older."id_user" = newer."id_user"
	AND older."id_level" = newer."id_level"
	AND (
		COALESCE(older."date_updated", older."date_created")
			< COALESCE(newer."date_updated", newer."date_created")
		OR (
			COALESCE(older."date_updated", older."date_created")
				= COALESCE(newer."date_updated", newer."date_created")
			AND older."id" < newer."id"
		)
	);--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_auth_refresh_token_hash" ON "auth" USING btree ("refresh_token_hash") WHERE "auth"."refresh_token_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_user_steam_id" ON "user" USING btree ("steam_id") WHERE "user"."steam_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_user_discord_id" ON "user" USING btree ("discord_id") WHERE "user"."discord_id" > 0;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "UQ_vote_user_level" UNIQUE("id_user","id_level");
