CREATE TABLE "zc_private"."points_history_prune_state" (
	"history" text PRIMARY KEY NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"budget_date" date NOT NULL,
	"deleted_today" integer DEFAULT 0 NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CK_points_history_prune_state_history" CHECK ("zc_private"."points_history_prune_state"."history" IN ('level_points_history', 'user_points_history')),
	CONSTRAINT "CK_points_history_prune_state_deleted_today" CHECK ("zc_private"."points_history_prune_state"."deleted_today" >= 0)
);
