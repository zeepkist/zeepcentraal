CREATE TABLE "track_tournament" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "track_tournament_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" integer NOT NULL,
	"slug" text NOT NULL,
	"id_level" integer NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"finalized_at" timestamp with time zone,
	"points_version" integer DEFAULT 1 NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone,
	CONSTRAINT "UQ_track_tournament_type_level" UNIQUE("type","id_level"),
	CONSTRAINT "UQ_track_tournament_type_start" UNIQUE("type","start_at"),
	CONSTRAINT "UQ_track_tournament_type_slug" UNIQUE("type","slug"),
	CONSTRAINT "CK_track_tournament_type" CHECK ("track_tournament"."type" IN (0, 1)),
	CONSTRAINT "CK_track_tournament_period" CHECK ("track_tournament"."end_at" > "track_tournament"."start_at"),
	CONSTRAINT "CK_track_tournament_points_version" CHECK ("track_tournament"."points_version" = 1)
);
--> statement-breakpoint
CREATE TABLE "track_tournament_result" (
	"id_tournament" integer NOT NULL,
	"id_user" integer NOT NULL,
	"id_record" integer NOT NULL,
	"time" real NOT NULL,
	"rank" integer NOT NULL,
	"points" integer NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone,
	CONSTRAINT "track_tournament_result_id_tournament_id_user_pk" PRIMARY KEY("id_tournament","id_user"),
	CONSTRAINT "CK_track_tournament_result_rank" CHECK ("track_tournament_result"."rank" > 0),
	CONSTRAINT "CK_track_tournament_result_points" CHECK ("track_tournament_result"."points" >= 2 AND MOD("track_tournament_result"."points", 2) = 0)
);
--> statement-breakpoint
ALTER TABLE "track_tournament" ADD CONSTRAINT "track_tournament_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_tournament_result" ADD CONSTRAINT "track_tournament_result_tournament_fkey" FOREIGN KEY ("id_tournament") REFERENCES "public"."track_tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_tournament_result" ADD CONSTRAINT "track_tournament_result_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_tournament_result" ADD CONSTRAINT "track_tournament_result_record_fkey" FOREIGN KEY ("id_record") REFERENCES "public"."record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_track_tournament_type_id" ON "track_tournament" USING btree ("type","id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "IX_track_tournament_level_period" ON "track_tournament" USING btree ("id_level","start_at","end_at");--> statement-breakpoint
CREATE INDEX "IX_track_tournament_result_tournament_rank" ON "track_tournament_result" USING btree ("id_tournament","rank","time","id_record");--> statement-breakpoint
CREATE INDEX "IX_track_tournament_result_record" ON "track_tournament_result" USING btree ("id_record");--> statement-breakpoint

COMMENT ON TABLE public.track_tournament IS E'@behavior -insert -update -delete';--> statement-breakpoint
COMMENT ON TABLE public.track_tournament_result IS E'@behavior -insert -update -delete';--> statement-breakpoint

DROP TRIGGER IF EXISTS trg__live_query_invalidate ON public.track_tournament;--> statement-breakpoint
CREATE TRIGGER trg__live_query_invalidate
AFTER INSERT OR UPDATE OR DELETE ON public.track_tournament
FOR EACH STATEMENT EXECUTE FUNCTION public.tg__live_query_invalidate();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg__live_query_invalidate ON public.track_tournament_result;--> statement-breakpoint
CREATE TRIGGER trg__live_query_invalidate
AFTER INSERT OR UPDATE OR DELETE ON public.track_tournament_result
FOR EACH STATEMENT EXECUTE FUNCTION public.tg__live_query_invalidate();--> statement-breakpoint

REVOKE ALL ON TABLE public.track_tournament, public.track_tournament_result FROM PUBLIC;--> statement-breakpoint
GRANT SELECT ON TABLE public.track_tournament, public.track_tournament_result TO zeepcentraal_graphql;
