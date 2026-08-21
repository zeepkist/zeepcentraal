CREATE TABLE "zc_private"."managed_lobby" (
	"key" text PRIMARY KEY NOT NULL,
	"join_id" text NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zc_private"."track_tournament_lobby_asset" (
	"id_tournament" integer PRIMARY KEY NOT NULL,
	"workshop_id" bigint NOT NULL,
	"file_uid" text NOT NULL,
	"level_name" text NOT NULL,
	"author" text NOT NULL,
	"collaborators" text DEFAULT '' NOT NULL,
	"override_author_name" text DEFAULT '' NOT NULL,
	"object_key" text NOT NULL,
	"content_sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_track_tournament_lobby_asset_object_key" UNIQUE("object_key"),
	CONSTRAINT "CK_track_tournament_lobby_asset_byte_size" CHECK ("zc_private"."track_tournament_lobby_asset"."byte_size" > 0)
);
--> statement-breakpoint
ALTER TABLE "zc_private"."track_tournament_lobby_asset" ADD CONSTRAINT "track_tournament_lobby_asset_tournament_fkey" FOREIGN KEY ("id_tournament") REFERENCES "public"."track_tournament"("id") ON DELETE cascade ON UPDATE no action;