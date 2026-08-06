CREATE TABLE "zc_private"."discord_worker_state" (
	"key" text PRIMARY KEY NOT NULL,
	"cursor_event_id" bigint DEFAULT 0 NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zc_private"."discord_watch" ADD COLUMN "last_delivery_key" text;