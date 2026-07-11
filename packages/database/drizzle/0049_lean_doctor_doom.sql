ALTER TABLE "user"
	ADD CONSTRAINT "UQ_user_steam_id" UNIQUE USING INDEX "UQ_user_steam_id";
