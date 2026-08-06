CREATE TABLE "discord_activity_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "discord_activity_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 100),
	"kind" text NOT NULL,
	"id_level" integer,
	"id_user" integer,
	"id_previous_user" integer,
	"id_record" integer,
	"id_previous_record" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CK_discord_activity_event_kind" CHECK ("discord_activity_event"."kind" IN ('workshop', 'personal_best', 'world_record', 'rank_batch', 'vote'))
);
--> statement-breakpoint
ALTER TABLE "discord_activity_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "zc_private"."discord_delivery" (
	"guild_id" bigint NOT NULL,
	"event_id" bigint NOT NULL,
	"channel_id" bigint NOT NULL,
	"message_id" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_delivery_guild_id_event_id_pk" PRIMARY KEY("guild_id","event_id"),
	CONSTRAINT "CK_discord_delivery_status" CHECK ("zc_private"."discord_delivery"."status" IN ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "zc_private"."discord_digest" (
	"guild_id" bigint PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"daily_enabled" boolean DEFAULT false NOT NULL,
	"weekly_enabled" boolean DEFAULT false NOT NULL,
	"delivery_hour" integer DEFAULT 9 NOT NULL,
	"weekly_day" integer DEFAULT 1 NOT NULL,
	"next_delivery_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zc_private"."discord_guild_config" (
	"guild_id" bigint PRIMARY KEY NOT NULL,
	"linked_role_id" bigint,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zc_private"."discord_guild_feed" (
	"guild_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"channel_id" bigint NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"cursor_event_id" bigint DEFAULT 0 NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_guild_feed_guild_id_kind_pk" PRIMARY KEY("guild_id","kind"),
	CONSTRAINT "CK_discord_guild_feed_kind" CHECK ("zc_private"."discord_guild_feed"."kind" IN ('workshop', 'world_record', 'rank', 'totw', 'totm'))
);
--> statement-breakpoint
CREATE TABLE "zc_private"."discord_link_code" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zc_private"."discord_oauth_link_state" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zc_private"."discord_tournament_message" (
	"guild_id" bigint NOT NULL,
	"id_tournament" integer NOT NULL,
	"channel_id" bigint NOT NULL,
	"message_id" bigint NOT NULL,
	"content_hash" text NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_tournament_message_guild_id_id_tournament_pk" PRIMARY KEY("guild_id","id_tournament")
);
--> statement-breakpoint
CREATE TABLE "zc_private"."discord_user_preference" (
	"discord_id" bigint PRIMARY KEY NOT NULL,
	"ping_on_world_record_loss" boolean DEFAULT false NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zc_private"."discord_watch" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "zc_private"."discord_watch_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"discord_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_discord_watch_target" UNIQUE("discord_id","kind","target_id"),
	CONSTRAINT "CK_discord_watch_kind" CHECK ("zc_private"."discord_watch"."kind" IN ('player', 'level', 'author', 'tournament'))
);
--> statement-breakpoint
ALTER TABLE "discord_activity_event" ADD CONSTRAINT "discord_activity_event_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_activity_event" ADD CONSTRAINT "discord_activity_event_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_activity_event" ADD CONSTRAINT "discord_activity_event_previous_user_fkey" FOREIGN KEY ("id_previous_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_activity_event" ADD CONSTRAINT "discord_activity_event_record_fkey" FOREIGN KEY ("id_record") REFERENCES "public"."record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_activity_event" ADD CONSTRAINT "discord_activity_event_previous_record_fkey" FOREIGN KEY ("id_previous_record") REFERENCES "public"."record"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
COMMENT ON CONSTRAINT "discord_activity_event_level_fkey" ON public.discord_activity_event IS E'@fieldName level';--> statement-breakpoint
COMMENT ON CONSTRAINT "discord_activity_event_user_fkey" ON public.discord_activity_event IS E'@fieldName user';--> statement-breakpoint
COMMENT ON CONSTRAINT "discord_activity_event_previous_user_fkey" ON public.discord_activity_event IS E'@fieldName previousUser';--> statement-breakpoint
COMMENT ON CONSTRAINT "discord_activity_event_record_fkey" ON public.discord_activity_event IS E'@fieldName record';--> statement-breakpoint
COMMENT ON CONSTRAINT "discord_activity_event_previous_record_fkey" ON public.discord_activity_event IS E'@fieldName previousRecord';--> statement-breakpoint
ALTER TABLE "zc_private"."discord_delivery" ADD CONSTRAINT "discord_delivery_event_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."discord_activity_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."discord_link_code" ADD CONSTRAINT "discord_link_code_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."discord_oauth_link_state" ADD CONSTRAINT "discord_oauth_link_state_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."discord_tournament_message" ADD CONSTRAINT "discord_tournament_message_tournament_fkey" FOREIGN KEY ("id_tournament") REFERENCES "public"."track_tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_discord_activity_event_kind_id" ON "discord_activity_event" USING btree ("kind","id");--> statement-breakpoint
CREATE INDEX "IX_discord_activity_event_user_occurred" ON "discord_activity_event" USING btree ("id_user","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_discord_activity_event_level_occurred" ON "discord_activity_event" USING btree ("id_level","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_discord_guild_feed_enabled" ON "zc_private"."discord_guild_feed" USING btree ("enabled","kind");--> statement-breakpoint
CREATE INDEX "IX_discord_link_code_user_expiry" ON "zc_private"."discord_link_code" USING btree ("id_user","expires_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_discord_oauth_link_state_expiry" ON "zc_private"."discord_oauth_link_state" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IX_discord_watch_target" ON "zc_private"."discord_watch" USING btree ("kind","target_id");--> statement-breakpoint
CREATE POLICY "graphql_select_visible_discord_activity_event" ON "discord_activity_event" AS PERMISSIVE FOR SELECT TO "zeepcentraal_graphql" USING ("discord_activity_event"."id_level" IS NULL OR EXISTS (
				SELECT 1 FROM public.level AS discord_visible_level
				WHERE discord_visible_level.id = "discord_activity_event"."id_level"
					AND discord_visible_level.publicly_visible = true
			));--> statement-breakpoint

GRANT SELECT ON TABLE public.discord_activity_event TO zeepcentraal_graphql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_discord_workshop_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
	should_publish boolean := false;
BEGIN
	IF TG_OP = 'INSERT' THEN
		should_publish := NEW.publicly_visible = true AND NEW.deleted = false;
	ELSIF TG_OP = 'UPDATE' THEN
		should_publish := NEW.publicly_visible = true
			AND NEW.deleted = false
			AND (OLD.publicly_visible = false OR OLD.deleted = true);
	END IF;
	IF should_publish THEN
		INSERT INTO public.discord_activity_event (kind, id_level, payload, occurred_at)
		VALUES (
			'workshop',
			NEW.id_level,
			jsonb_build_object(
				'idLevelItem', NEW.id,
				'workshopId', NEW.workshop_id::text,
				'name', NEW.name,
				'author', NEW.file_author,
				'imageUrl', NEW.image_url
			),
			COALESCE(NEW.created_at, now())
		);
	END IF;
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_discord_personal_best_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
	new_time real;
	previous_time real;
BEGIN
	IF TG_OP = 'UPDATE' AND NEW.id_record = OLD.id_record THEN
		RETURN NULL;
	END IF;
	SELECT submitted_record.time INTO new_time
	FROM public.record AS submitted_record
	WHERE submitted_record.id = NEW.id_record;
	IF TG_OP = 'UPDATE' THEN
		SELECT submitted_record.time INTO previous_time
		FROM public.record AS submitted_record
		WHERE submitted_record.id = OLD.id_record;
	END IF;
	INSERT INTO public.discord_activity_event (
		kind,
		id_level,
		id_user,
		id_previous_user,
		id_record,
		id_previous_record,
		payload,
		occurred_at
	)
	VALUES (
		'personal_best',
		NEW.id_level,
		NEW.id_user,
		CASE WHEN TG_OP = 'UPDATE' THEN OLD.id_user END,
		NEW.id_record,
		CASE WHEN TG_OP = 'UPDATE' THEN OLD.id_record END,
		jsonb_build_object('time', new_time, 'previousTime', previous_time),
		COALESCE(NEW.date_updated, NEW.date_created, now())
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_discord_world_record_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
	new_time real;
	previous_time real;
BEGIN
	IF TG_OP = 'UPDATE' AND NEW.id_record = OLD.id_record THEN
		RETURN NULL;
	END IF;
	SELECT submitted_record.time INTO new_time
	FROM public.record AS submitted_record
	WHERE submitted_record.id = NEW.id_record;
	IF TG_OP = 'UPDATE' THEN
		SELECT submitted_record.time INTO previous_time
		FROM public.record AS submitted_record
		WHERE submitted_record.id = OLD.id_record;
	END IF;
	INSERT INTO public.discord_activity_event (
		kind,
		id_level,
		id_user,
		id_previous_user,
		id_record,
		id_previous_record,
		payload,
		occurred_at
	)
	VALUES (
		'world_record',
		NEW.id_level,
		NEW.id_user,
		CASE WHEN TG_OP = 'UPDATE' THEN OLD.id_user END,
		NEW.id_record,
		CASE WHEN TG_OP = 'UPDATE' THEN OLD.id_record END,
		jsonb_build_object('time', new_time, 'previousTime', previous_time),
		COALESCE(NEW.date_updated, NEW.date_created, now())
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_discord_vote_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	IF TG_OP = 'UPDATE' AND NEW.value = OLD.value THEN
		RETURN NULL;
	END IF;
	INSERT INTO public.discord_activity_event (
		kind,
		id_level,
		id_user,
		payload,
		occurred_at
	)
	VALUES (
		'vote',
		NEW.id_level,
		NEW.id_user,
		jsonb_build_object(
			'value', NEW.value,
			'previousValue', CASE WHEN TG_OP = 'UPDATE' THEN OLD.value END
		),
		COALESCE(NEW.date_updated, NEW.date_created, now())
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "trg__discord_workshop_event"
AFTER INSERT OR UPDATE OF publicly_visible, deleted ON public.level_item
FOR EACH ROW EXECUTE FUNCTION zc_private.tg_discord_workshop_event();--> statement-breakpoint

CREATE TRIGGER "trg__discord_personal_best_event"
AFTER INSERT OR UPDATE OF id_record ON public.personal_best_global
FOR EACH ROW EXECUTE FUNCTION zc_private.tg_discord_personal_best_event();--> statement-breakpoint

CREATE TRIGGER "trg__discord_world_record_event"
AFTER INSERT OR UPDATE OF id_record ON public.world_record_global
FOR EACH ROW EXECUTE FUNCTION zc_private.tg_discord_world_record_event();--> statement-breakpoint

CREATE TRIGGER "trg__discord_vote_event"
AFTER INSERT OR UPDATE OF value ON public.vote
FOR EACH ROW EXECUTE FUNCTION zc_private.tg_discord_vote_event();--> statement-breakpoint

CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON public.discord_activity_event
FOR EACH STATEMENT EXECUTE FUNCTION public.tg__live_query_invalidate();--> statement-breakpoint

ALTER FUNCTION zc_private.tg_discord_workshop_event() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_discord_personal_best_event() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_discord_world_record_event() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_discord_vote_event() OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_discord_workshop_event() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_discord_personal_best_event() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_discord_world_record_event() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_discord_vote_event() FROM PUBLIC;
