SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '300s';
DROP TRIGGER level_item_medal_inputs ON public.level_item;
DROP FUNCTION zc_private.tg_level_item_medal_inputs();
CREATE TABLE public.level_medal_threshold (
 id_level integer PRIMARY KEY REFERENCES public.level(id) ON DELETE CASCADE,
 source_item_id integer REFERENCES public.level_item(id) ON DELETE SET NULL,
 author_ms bigint, gold_ms bigint, silver_ms bigint, bronze_ms bigint,
 qualified_at timestamptz, due_at timestamptz,
 expert_ms bigint, apex_ms bigint,
 revision integer NOT NULL DEFAULT 0,
 calculation_version integer NOT NULL DEFAULT 1,
 eligible_pb_count integer NOT NULL DEFAULT 0,
 calculated_at timestamptz,
 evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((expert_ms IS NULL AND apex_ms IS NULL) OR (apex_ms>0 AND apex_ms<expert_ms AND expert_ms<author_ms))
);
COMMENT ON TABLE public.level_medal_threshold IS E'@behavior -insert -update -delete';
CREATE INDEX level_medal_threshold_due ON public.level_medal_threshold(due_at,id_level) WHERE due_at IS NOT NULL;
ALTER TABLE public.level_medal_threshold ENABLE ROW LEVEL SECURITY;
CREATE POLICY graphql_medal_threshold ON public.level_medal_threshold FOR SELECT TO zeepcentraal_graphql
 USING(EXISTS(SELECT 1 FROM public.level l WHERE l.id=id_level AND l.publicly_visible)
 AND EXISTS(SELECT 1 FROM public.level_item i WHERE i.id_level=level_medal_threshold.id_level AND i.publicly_visible AND NOT i.deleted));

CREATE TABLE zc_private.level_medal_revision (
 id_level integer NOT NULL REFERENCES public.level(id) ON DELETE CASCADE,
 revision integer NOT NULL,
 content_hash text NOT NULL,
 source_item_id integer,
 author_ms bigint,
 expert_ms bigint, apex_ms bigint,
 eligible_pb_count integer NOT NULL,
 calculation_version integer NOT NULL DEFAULT 1,
 calculated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reason text NOT NULL CHECK(reason IN ('backfill','finalisation','author_time')),
 reference_records jsonb NOT NULL,
 PRIMARY KEY(id_level,revision)
);

-- Rollback restores the previous schema with current calculations, not deleted history.
WITH items AS (
 SELECT DISTINCT ON(id_level) * FROM public.level_item
 ORDER BY id_level,(medal_qualified_at IS NOT NULL OR medal_calculated_at IS NOT NULL) DESC,
  (NOT deleted AND publicly_visible) DESC,updated_at DESC,id DESC
)
INSERT INTO public.level_medal_threshold(id_level,source_item_id,author_ms,gold_ms,silver_ms,bronze_ms,
 qualified_at,due_at,expert_ms,apex_ms,revision,calculation_version,eligible_pb_count,calculated_at,evaluated_at)
SELECT id_level,id,zc_private.medal_milliseconds(validation_time_author),zc_private.medal_milliseconds(validation_time_gold),
 zc_private.medal_milliseconds(validation_time_silver),zc_private.medal_milliseconds(validation_time_bronze),
 medal_qualified_at,medal_due_at,zc_private.medal_milliseconds(validation_time_expert),zc_private.medal_milliseconds(validation_time_apex),
 CASE WHEN medal_calculated_at IS NOT NULL THEN 1 ELSE 0 END,coalesce(medal_calculation_version,1),
 medal_eligible_pb_count,medal_calculated_at,medal_evaluated_at FROM items;
DROP FUNCTION zc_private.level_medal_reference(integer,bigint);
CREATE FUNCTION zc_private.level_medal_reference(level_id integer,author_ms bigint)
RETURNS TABLE(eligible_count integer,times bigint[],reference_records jsonb)
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 WITH eligible AS (
  SELECT pb.id_user,r.id,zc_private.medal_milliseconds(r.time) AS time_ms
  FROM public.personal_best_global pb JOIN public.record r ON r.id=pb.id_record
  JOIN public."user" u ON u.id=pb.id_user
  WHERE pb.id_level=level_id AND pb.record_eligible AND r.record_eligible AND NOT u.banned
 ), ranked AS (
  SELECT *,row_number() OVER(ORDER BY time_ms,id) AS position FROM eligible WHERE time_ms>0 AND time_ms<author_ms
 ) SELECT count(*)::integer,array_agg(time_ms ORDER BY time_ms,id) FILTER(WHERE position<=10),
  coalesce(jsonb_agg(jsonb_build_object('userId',id_user,'recordId',id,'timeMs',time_ms) ORDER BY time_ms,id) FILTER(WHERE position<=10),'[]'::jsonb)
 FROM ranked
$$;

CREATE OR REPLACE FUNCTION public.record_medal(record public.record) RETURNS smallint
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT zc_private.medal_tier(m.time_ms,
 zc_private.medal_milliseconds(i.validation_time_bronze),zc_private.medal_milliseconds(i.validation_time_silver),
 zc_private.medal_milliseconds(i.validation_time_gold),zc_private.medal_milliseconds(i.validation_time_author),t.expert_ms,t.apex_ms)
 FROM public.level l
 JOIN LATERAL(SELECT * FROM public.level_item i WHERE i.id_level=l.id AND NOT i.deleted AND i.publicly_visible ORDER BY i.updated_at DESC,i.id DESC LIMIT 1) i ON true
 LEFT JOIN public.level_medal_threshold t ON t.id_level=l.id
 CROSS JOIN LATERAL(SELECT zc_private.medal_milliseconds(record.time) AS time_ms) m
 WHERE l.id=record.id_level AND record.record_eligible AND m.time_ms>0
 AND EXISTS(SELECT 1 FROM public."user" u WHERE u.id=record.id_user AND NOT u.banned)
$$;
CREATE OR REPLACE FUNCTION zc_private.refresh_level_medals(level_id integer) RETURNS boolean
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE previous public.level_medal_threshold; item public.level_item;
 author_changed boolean; population record; calculated record; target_author bigint; reason text;
BEGIN
 IF NOT pg_try_advisory_xact_lock(1869000001,level_id) THEN RETURN false; END IF;
 SELECT * INTO previous FROM public.level_medal_threshold WHERE id_level=level_id FOR UPDATE;
 SELECT i.* INTO item FROM public.level_item i JOIN public.level l ON l.id=i.id_level
 WHERE i.id_level=level_id AND NOT i.deleted AND i.publicly_visible AND l.publicly_visible AND l.xx_hash IS NOT NULL AND l.xx_hash<>''
 ORDER BY i.updated_at DESC,i.id DESC LIMIT 1;
 IF NOT FOUND THEN
  -- Availability removes counts, not frozen calculations. Reappearance restores them.
  UPDATE public.level_medal_threshold SET evaluated_at=clock_timestamp() WHERE id_level=level_id;
  RETURN true;
 END IF;
 target_author:=zc_private.medal_milliseconds(item.validation_time_author);
 author_changed:=previous.author_ms IS DISTINCT FROM target_author;
 SELECT * INTO population FROM zc_private.level_medal_reference(level_id,target_author);
 INSERT INTO public.level_medal_threshold(id_level,source_item_id,author_ms,gold_ms,silver_ms,bronze_ms)
 VALUES(level_id,item.id,target_author,zc_private.medal_milliseconds(item.validation_time_gold),zc_private.medal_milliseconds(item.validation_time_silver),zc_private.medal_milliseconds(item.validation_time_bronze))
 ON CONFLICT(id_level) DO UPDATE SET source_item_id=excluded.source_item_id,
 expert_ms=CASE WHEN level_medal_threshold.author_ms IS DISTINCT FROM excluded.author_ms THEN NULL ELSE level_medal_threshold.expert_ms END,
 apex_ms=CASE WHEN level_medal_threshold.author_ms IS DISTINCT FROM excluded.author_ms THEN NULL ELSE level_medal_threshold.apex_ms END,
 author_ms=excluded.author_ms,
 gold_ms=excluded.gold_ms,silver_ms=excluded.silver_ms,bronze_ms=excluded.bronze_ms;
 IF previous.qualified_at IS NULL AND population.eligible_count>=10 THEN
  UPDATE public.level_medal_threshold SET qualified_at=clock_timestamp(),due_at=clock_timestamp()+interval '7 days' WHERE id_level=level_id;
 END IF;
 IF (previous.revision>0 AND author_changed) OR
  (previous.expert_ms IS NULL AND (previous.revision>0 OR previous.due_at<=clock_timestamp())) THEN
  SELECT * INTO calculated FROM zc_private.calculate_medal_thresholds(target_author,population.times);
  reason:=CASE WHEN previous.revision>0 THEN 'author_time' ELSE 'finalisation' END;
  IF author_changed OR calculated.expert_ms IS NOT NULL THEN
   UPDATE public.level_medal_threshold SET expert_ms=calculated.expert_ms,apex_ms=calculated.apex_ms,
    revision=revision+1,eligible_pb_count=population.eligible_count,calculated_at=clock_timestamp(),
    due_at=CASE WHEN calculated.expert_ms IS NULL THEN due_at ELSE NULL END WHERE id_level=level_id;
   INSERT INTO zc_private.level_medal_revision(id_level,revision,content_hash,source_item_id,author_ms,expert_ms,apex_ms,eligible_pb_count,calculated_at,reason,reference_records)
   SELECT t.id_level,t.revision,l.xx_hash,t.source_item_id,t.author_ms,t.expert_ms,t.apex_ms,t.eligible_pb_count,t.calculated_at,reason,population.reference_records
   FROM public.level_medal_threshold t JOIN public.level l ON l.id=t.id_level WHERE t.id_level=level_id;
  END IF;
 END IF;
 UPDATE public.level_medal_threshold SET evaluated_at=clock_timestamp() WHERE id_level=level_id;
 UPDATE public.personal_best_global pb SET medal=classification.medal FROM (
  SELECT r.id,CASE WHEN p.record_eligible AND r.record_eligible AND NOT u.banned THEN
   zc_private.medal_tier(zc_private.medal_milliseconds(r.time),t.bronze_ms,t.silver_ms,t.gold_ms,t.author_ms,t.expert_ms,t.apex_ms) END AS medal
  FROM public.record r JOIN public.personal_best_global p ON p.id_record=r.id AND p.id_level=level_id
  JOIN public."user" u ON u.id=r.id_user JOIN public.level_medal_threshold t ON t.id_level=p.id_level
 ) classification WHERE pb.id_level=level_id AND pb.id_record=classification.id AND pb.medal IS DISTINCT FROM classification.medal;
 RETURN true;
END $$;

CREATE TRIGGER trg__live_query_invalidate AFTER INSERT OR UPDATE OR DELETE ON public.level_medal_threshold
 FOR EACH STATEMENT EXECUTE FUNCTION public.tg__live_query_invalidate();
REVOKE ALL ON public.level_medal_threshold,zc_private.level_medal_revision FROM PUBLIC;
GRANT SELECT ON public.level_medal_threshold TO zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.level_medal_reference(integer,bigint) FROM PUBLIC;
ALTER TABLE public.level_item DROP CONSTRAINT level_item_competitive_medals_check,
 DROP COLUMN validation_time_expert,DROP COLUMN validation_time_apex,DROP COLUMN medal_qualified_at,
 DROP COLUMN medal_due_at,DROP COLUMN medal_calculated_at,DROP COLUMN medal_calculation_version,
 DROP COLUMN medal_eligible_pb_count,DROP COLUMN medal_evaluated_at;
DROP FUNCTION zc_private.medal_milliseconds(double precision);
