CREATE TABLE "player_skill_aggregate" (
	"id_user" integer PRIMARY KEY NOT NULL,
	"placement_sum" double precision NOT NULL,
	"eligible_level_count" integer NOT NULL,
	"skill" real NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "modifier_evidence" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "modifier_quality" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "competitive_merit" real;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "complexity_confidence" real;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "complexity_score" real;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "field_strength" real;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "quality_score" real;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "skill_alignment" real;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "skill_confidence" real;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "skill_sample_size" integer;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "skill_score" real;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "skill_separation" real;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "modifier_evidence" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "modifier_quality" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "competitive_merit" real;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "complexity_confidence" real;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "complexity_score" real;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "field_strength" real;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "quality_score" real;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "skill_alignment" real;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "skill_confidence" real;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "skill_sample_size" integer;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "skill_score" real;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "skill_separation" real;--> statement-breakpoint
ALTER TABLE "player_skill_aggregate" ADD CONSTRAINT "player_skill_aggregate_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_player_skill_aggregate_skill_user" ON "player_skill_aggregate" USING btree ("skill" DESC NULLS LAST,"id_user");