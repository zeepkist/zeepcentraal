CREATE TABLE "live_query_invalidations" (
	"id" bigserial PRIMARY KEY,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"schema_name" text NOT NULL,
	"table_name" text NOT NULL,
	"operation" text NOT NULL
);

COMMENT ON TABLE "live_query_invalidations" IS E'@omit';

CREATE INDEX "IX_live_query_invalidations_created_at"
	ON "live_query_invalidations" ("created_at");

CREATE OR REPLACE FUNCTION "tg__live_query_invalidate"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	INSERT INTO "live_query_invalidations" ("schema_name", "table_name", "operation")
	VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP);

	RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "level";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "level"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "level_item";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "level_item"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "workshop_item";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "workshop_item"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "level_metadata";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "level_metadata"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "level_points";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "level_points"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "level_points_history";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "level_points_history"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "level_request";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "level_request"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "personal_best_global";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "personal_best_global"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "user_points";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "user_points"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "user_point_contribution";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "user_point_contribution"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "user_points_history";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "user_points_history"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "record";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "record"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "record_media";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "record_media"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "record_statistic";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "record_statistic"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "user";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "user"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "version";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "version"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "favourite";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "favourite"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "vote";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "vote"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "world_record_global";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "world_record_global"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "zsl_points_structure";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "zsl_points_structure"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "zsl_season";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "zsl_season"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "zsl_round";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "zsl_round"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "zsl_level";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "zsl_level"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "zsl_level_result";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "zsl_level_result"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "zsl_round_result";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "zsl_round_result"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();

DROP TRIGGER IF EXISTS "trg__live_query_invalidate" ON "zsl_season_result";
CREATE TRIGGER "trg__live_query_invalidate"
AFTER INSERT OR UPDATE OR DELETE ON "zsl_season_result"
FOR EACH STATEMENT EXECUTE FUNCTION "tg__live_query_invalidate"();
