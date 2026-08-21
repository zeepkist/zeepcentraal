CREATE TABLE "lobby" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lobby_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 100),
	"master_id" text NOT NULL,
	"room_name" text NOT NULL,
	"host_id" bigint NOT NULL,
	"players" integer NOT NULL,
	"player_limit" integer NOT NULL,
	"is_public" boolean NOT NULL,
	"peak_players" integer NOT NULL,
	"peak_time" timestamp with time zone NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_lobby_master_id" UNIQUE("master_id"),
	CONSTRAINT "CK_lobby_players_nonnegative" CHECK ("lobby"."players" >= 0),
	CONSTRAINT "CK_lobby_player_limit_nonnegative" CHECK ("lobby"."player_limit" >= 0),
	CONSTRAINT "CK_lobby_peak_players_nonnegative" CHECK ("lobby"."peak_players" >= 0),
	CONSTRAINT "CK_lobby_peak_players_current" CHECK ("lobby"."peak_players" >= "lobby"."players")
);
--> statement-breakpoint
ALTER TABLE "lobby" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lobby_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lobby_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 100),
	"lobby_id" bigint NOT NULL,
	"host_id" bigint NOT NULL,
	"change_type" text NOT NULL,
	"room_name" text NOT NULL,
	"players" integer NOT NULL,
	"player_limit" integer NOT NULL,
	"is_public" boolean NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CK_lobby_history_change_type" CHECK ("lobby_history"."change_type" IN ('opened', 'updated', 'closed', 'reopened')),
	CONSTRAINT "CK_lobby_history_players_nonnegative" CHECK ("lobby_history"."players" >= 0),
	CONSTRAINT "CK_lobby_history_player_limit_nonnegative" CHECK ("lobby_history"."player_limit" >= 0)
);
--> statement-breakpoint
ALTER TABLE "lobby_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lobby_stats" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lobby_stats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 100),
	"players" integer NOT NULL,
	"rooms" integer NOT NULL,
	"players_in_rooms" integer NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CK_lobby_stats_players_nonnegative" CHECK ("lobby_stats"."players" >= 0),
	CONSTRAINT "CK_lobby_stats_rooms_nonnegative" CHECK ("lobby_stats"."rooms" >= 0),
	CONSTRAINT "CK_lobby_stats_players_in_rooms_nonnegative" CHECK ("lobby_stats"."players_in_rooms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "lobby_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lobby" ADD CONSTRAINT "lobby_host_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."user"("steam_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lobby_history" ADD CONSTRAINT "lobby_history_lobby_fkey" FOREIGN KEY ("lobby_id") REFERENCES "public"."lobby"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lobby_history" ADD CONSTRAINT "lobby_history_host_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."user"("steam_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_lobby_host" ON "lobby" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "IX_lobby_closed_last_seen" ON "lobby" USING btree ("closed_at" NULLS FIRST,"last_seen" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_lobby_first_seen_id" ON "lobby" USING btree ("first_seen" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_lobby_history_lobby_id" ON "lobby_history" USING btree ("lobby_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_lobby_history_host" ON "lobby_history" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "IX_lobby_history_observed_id" ON "lobby_history" USING btree ("observed_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_lobby_stats_date_created_id" ON "lobby_stats" USING btree ("date_created" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "graphql_select_lobby" ON "lobby" AS PERMISSIVE FOR SELECT TO "zeepcentraal_graphql" USING (true);--> statement-breakpoint
CREATE POLICY "graphql_select_lobby_history" ON "lobby_history" AS PERMISSIVE FOR SELECT TO "zeepcentraal_graphql" USING (true);--> statement-breakpoint
CREATE POLICY "graphql_select_lobby_stats" ON "lobby_stats" AS PERMISSIVE FOR SELECT TO "zeepcentraal_graphql" USING (true);--> statement-breakpoint

COMMENT ON TABLE public.lobby IS E'@behavior -insert -update -delete';--> statement-breakpoint
COMMENT ON TABLE public.lobby_history IS E'@behavior -insert -update -delete';--> statement-breakpoint
COMMENT ON TABLE public.lobby_stats IS E'@behavior -insert -update -delete';--> statement-breakpoint
COMMENT ON COLUMN public.lobby.master_id IS E'@omit';--> statement-breakpoint
COMMENT ON CONSTRAINT "lobby_host_fkey" ON public.lobby IS E'@fieldName host\n@foreignFieldName hostedLobbies';--> statement-breakpoint
COMMENT ON CONSTRAINT "lobby_history_lobby_fkey" ON public.lobby_history IS E'@fieldName lobby\n@foreignFieldName history';--> statement-breakpoint
COMMENT ON CONSTRAINT "lobby_history_host_fkey" ON public.lobby_history IS E'@fieldName host\n@foreignFieldName lobbyHistoryEntries';--> statement-breakpoint

REVOKE ALL ON TABLE public.lobby, public.lobby_history, public.lobby_stats FROM PUBLIC;--> statement-breakpoint
GRANT SELECT (
	id,
	room_name,
	host_id,
	players,
	player_limit,
	is_public,
	peak_players,
	peak_time,
	first_seen,
	last_seen,
	closed_at,
	date_created,
	date_updated
) ON TABLE public.lobby TO zeepcentraal_graphql;--> statement-breakpoint
GRANT SELECT ON TABLE public.lobby_history, public.lobby_stats TO zeepcentraal_graphql;
