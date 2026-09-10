CREATE TABLE "zc_private"."level_submission_contest" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zc_private"."level_submission_contest_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"thread_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"forum_id" text NOT NULL,
	"title" text NOT NULL,
	"theme" text NOT NULL,
	"season_number" integer NOT NULL,
	"round_number" integer NOT NULL,
	"id_zsl_round" integer,
	"mapping_source" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"rules" jsonb NOT NULL,
	"rules_hash" text NOT NULL,
	"last_complete_scan" timestamp with time zone,
	"frozen_at" timestamp with time zone,
	"current_playlist_id" bigint,
	"publication" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_submission_contest_thread_id_unique" UNIQUE("thread_id"),
	CONSTRAINT "submission_contest_state" CHECK ("zc_private"."level_submission_contest"."state" in ('open', 'frozen'))
);
--> statement-breakpoint
CREATE TABLE "zc_private"."level_submission_playlist" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zc_private"."level_submission_playlist_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id_contest" bigint NOT NULL,
	"digest" text NOT NULL,
	"valid_count" integer NOT NULL,
	"object_key" text NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_playlist_digest" UNIQUE("id_contest","digest")
);
--> statement-breakpoint
CREATE TABLE "zc_private"."level_submission_playlist_entry" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zc_private"."level_submission_playlist_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id_playlist" bigint NOT NULL,
	"position" integer NOT NULL,
	"id_validation" bigint NOT NULL,
	"workshop_id" bigint NOT NULL,
	CONSTRAINT "submission_playlist_position" UNIQUE("id_playlist","position"),
	CONSTRAINT "submission_playlist_workshop" UNIQUE("id_playlist","workshop_id")
);
--> statement-breakpoint
CREATE TABLE "zc_private"."level_submission_validation" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zc_private"."level_submission_validation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id_submission" bigint NOT NULL,
	"workshop_updated_at" text NOT NULL,
	"workshop_file_size" bigint NOT NULL,
	"content_sha256" text,
	"validator_version" text NOT NULL,
	"rules_hash" text NOT NULL,
	"id_level_item" integer,
	"file_uid" text,
	"measurements" jsonb NOT NULL,
	"failures" jsonb NOT NULL,
	"valid" boolean NOT NULL,
	"payload" jsonb,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zc_private"."level_submissions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zc_private"."level_submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id_contest" bigint NOT NULL,
	"message_id" text NOT NULL,
	"author_id" text NOT NULL,
	"workshop_id" bigint NOT NULL,
	"message_created_at" timestamp with time zone NOT NULL,
	"message_edited_at" timestamp with time zone,
	"state" text NOT NULL,
	"source_error" text,
	"last_seen" timestamp with time zone NOT NULL,
	"latest_validation_id" bigint,
	"retry_category" text,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_source_unique" UNIQUE("id_contest","message_id","workshop_id"),
	CONSTRAINT "submission_state" CHECK ("zc_private"."level_submissions"."state" in ('selected', 'superseded', 'withdrawn'))
);
--> statement-breakpoint
ALTER TABLE "zc_private"."level_submission_contest" ADD CONSTRAINT "level_submission_contest_id_zsl_round_zsl_round_id_fk" FOREIGN KEY ("id_zsl_round") REFERENCES "public"."zsl_round"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."level_submission_playlist" ADD CONSTRAINT "level_submission_playlist_id_contest_level_submission_contest_id_fk" FOREIGN KEY ("id_contest") REFERENCES "zc_private"."level_submission_contest"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."level_submission_playlist_entry" ADD CONSTRAINT "level_submission_playlist_entry_id_playlist_level_submission_playlist_id_fk" FOREIGN KEY ("id_playlist") REFERENCES "zc_private"."level_submission_playlist"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."level_submission_playlist_entry" ADD CONSTRAINT "level_submission_playlist_entry_id_validation_level_submission_validation_id_fk" FOREIGN KEY ("id_validation") REFERENCES "zc_private"."level_submission_validation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."level_submission_validation" ADD CONSTRAINT "level_submission_validation_id_submission_level_submissions_id_fk" FOREIGN KEY ("id_submission") REFERENCES "zc_private"."level_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."level_submission_validation" ADD CONSTRAINT "level_submission_validation_id_level_item_level_item_id_fk" FOREIGN KEY ("id_level_item") REFERENCES "public"."level_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."level_submissions" ADD CONSTRAINT "level_submissions_id_contest_level_submission_contest_id_fk" FOREIGN KEY ("id_contest") REFERENCES "zc_private"."level_submission_contest"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_validation_cache" ON "zc_private"."level_submission_validation" USING btree ("id_submission","rules_hash","validator_version");--> statement-breakpoint
CREATE INDEX "submission_author" ON "zc_private"."level_submissions" USING btree ("id_contest","author_id");--> statement-breakpoint
CREATE INDEX "submission_selected" ON "zc_private"."level_submissions" USING btree ("id_contest","state");--> statement-breakpoint
CREATE INDEX "submission_workshop" ON "zc_private"."level_submissions" USING btree ("workshop_id");