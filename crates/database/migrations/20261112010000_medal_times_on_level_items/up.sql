SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '300s';

ALTER TABLE public.level_item
 ADD COLUMN validation_time_expert double precision,
 ADD COLUMN validation_time_apex double precision,
 ADD COLUMN medal_qualified_at timestamptz,
 ADD COLUMN medal_due_at timestamptz,
 ADD COLUMN medal_calculated_at timestamptz,
 ADD COLUMN medal_calculation_version integer,
 ADD COLUMN medal_eligible_pb_count integer NOT NULL DEFAULT 0,
 ADD COLUMN medal_evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp();
COMMENT ON COLUMN public.level_item.validation_time_expert IS 'Expert target in seconds; null until available.';
COMMENT ON COLUMN public.level_item.validation_time_apex IS 'Apex target in seconds; null until available.';
COMMENT ON COLUMN public.level_item.medal_evaluated_at IS E'@omit\n@behavior -aggregate -groupBy -havingBy';
CREATE INDEX level_item_medal_due ON public.level_item(medal_due_at,id_level) WHERE medal_due_at IS NOT NULL;

-- Computed targets use double precision so integer-millisecond results survive storage.
CREATE FUNCTION zc_private.medal_milliseconds(seconds double precision) RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN seconds>0 AND seconds<1e12 THEN floor(seconds*1000+0.5)::bigint END
$$;

CREATE OR REPLACE FUNCTION zc_private.medal_tier(time_ms bigint,bronze_ms bigint,silver_ms bigint,gold_ms bigint,author_ms bigint,expert_ms bigint,apex_ms bigint)
RETURNS smallint LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN time_ms>0 THEN CASE
 WHEN time_ms<=apex_ms THEN 5 WHEN time_ms<=expert_ms THEN 4
 WHEN time_ms<=author_ms THEN 3 WHEN time_ms<=gold_ms THEN 2
 WHEN time_ms<=silver_ms THEN 1 WHEN time_ms<=bronze_ms THEN 0 END END::smallint
$$;

-- Move current state only. Existing Author/Gold/Silver/Bronze columns stay untouched.
-- Retain frozen calculations on a remaining item when a level is unavailable.
WITH source AS MATERIALIZED (
 SELECT i.id,t.*,
  zc_private.medal_milliseconds(i.validation_time_author) IS NOT DISTINCT FROM t.author_ms AS same_author,
  c.expert_ms AS new_expert_ms,c.apex_ms AS new_apex_ms,r.eligible_count AS new_count
 FROM public.level_medal_threshold t
 JOIN LATERAL(SELECT i.* FROM public.level_item i WHERE i.id_level=t.id_level
  ORDER BY (NOT i.deleted AND i.publicly_visible) DESC,i.updated_at DESC,i.id DESC LIMIT 1) i ON true
 LEFT JOIN LATERAL zc_private.level_medal_reference(t.id_level,zc_private.medal_milliseconds(i.validation_time_author)) r
  ON t.revision>0 AND t.author_ms IS DISTINCT FROM zc_private.medal_milliseconds(i.validation_time_author)
 LEFT JOIN LATERAL zc_private.calculate_medal_thresholds(zc_private.medal_milliseconds(i.validation_time_author),r.times) c
  ON t.revision>0 AND t.author_ms IS DISTINCT FROM zc_private.medal_milliseconds(i.validation_time_author)
)
UPDATE public.level_item i SET
 validation_time_expert=(CASE WHEN s.same_author THEN s.expert_ms WHEN s.revision>0 THEN s.new_expert_ms END)::double precision/1000,
 validation_time_apex=(CASE WHEN s.same_author THEN s.apex_ms WHEN s.revision>0 THEN s.new_apex_ms END)::double precision/1000,
 medal_qualified_at=s.qualified_at,
 medal_due_at=CASE
  WHEN s.revision>0 AND (CASE WHEN s.same_author THEN s.expert_ms ELSE s.new_expert_ms END) IS NULL THEN clock_timestamp()
  WHEN s.revision>0 THEN NULL ELSE s.due_at END,
 medal_calculated_at=CASE WHEN s.same_author AND s.expert_ms IS NOT NULL THEN s.calculated_at
  WHEN s.revision>0 AND s.new_expert_ms IS NOT NULL THEN clock_timestamp() END,
 medal_calculation_version=CASE WHEN (s.same_author AND s.expert_ms IS NOT NULL) OR (s.revision>0 AND s.new_expert_ms IS NOT NULL) THEN s.calculation_version END,
 medal_eligible_pb_count=CASE WHEN s.same_author THEN s.eligible_pb_count ELSE coalesce(s.new_count,0) END,
 medal_evaluated_at=s.evaluated_at
FROM source s WHERE i.id=s.id;

ALTER TABLE public.level_item ADD CONSTRAINT level_item_competitive_medals_check CHECK(
 (validation_time_expert IS NULL AND validation_time_apex IS NULL) OR
 (validation_time_expert IS NOT NULL AND validation_time_apex IS NOT NULL AND validation_time_apex>0
  AND validation_time_apex<validation_time_expert AND validation_time_expert<validation_time_author));

-- No persistent leaderboard snapshots or medal-time history.
DROP FUNCTION zc_private.level_medal_reference(integer,bigint);
CREATE FUNCTION zc_private.level_medal_reference(level_id integer,author_ms bigint)
RETURNS TABLE(eligible_count integer,times bigint[])
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 WITH eligible AS (
  SELECT r.id,zc_private.medal_milliseconds(r.time) AS time_ms
  FROM public.personal_best_global pb JOIN public.record r ON r.id=pb.id_record
  JOIN public."user" u ON u.id=pb.id_user
  WHERE pb.id_level=level_id AND pb.record_eligible AND r.record_eligible AND NOT u.banned
 ), ranked AS (
  SELECT *,row_number() OVER(ORDER BY time_ms,id) AS position FROM eligible WHERE time_ms>0 AND time_ms<author_ms
 ) SELECT count(*)::integer,array_agg(time_ms ORDER BY time_ms,id) FILTER(WHERE position<=10) FROM ranked
$$;

CREATE OR REPLACE FUNCTION public.record_medal(record public.record) RETURNS smallint
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT zc_private.medal_tier(zc_private.medal_milliseconds(record.time),
  zc_private.medal_milliseconds(i.validation_time_bronze),zc_private.medal_milliseconds(i.validation_time_silver),
  zc_private.medal_milliseconds(i.validation_time_gold),zc_private.medal_milliseconds(i.validation_time_author),
  zc_private.medal_milliseconds(i.validation_time_expert),zc_private.medal_milliseconds(i.validation_time_apex))
 FROM public.level_item i WHERE i.id_level=record.id_level AND NOT i.deleted AND i.publicly_visible
 AND record.record_eligible AND EXISTS(SELECT 1 FROM public."user" u WHERE u.id=record.id_user AND NOT u.banned)
 ORDER BY i.updated_at DESC,i.id DESC LIMIT 1
$$;

-- Clear targets when their inputs change. A finalised item recalculates without a new wait.
CREATE FUNCTION zc_private.tg_level_item_medal_inputs() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.id_level IS DISTINCT FROM OLD.id_level THEN
  NEW.validation_time_expert:=NULL; NEW.validation_time_apex:=NULL;
  NEW.medal_qualified_at:=NULL; NEW.medal_due_at:=NULL;
  NEW.medal_calculated_at:=NULL; NEW.medal_calculation_version:=NULL;
  NEW.medal_eligible_pb_count:=0; NEW.medal_evaluated_at:=clock_timestamp();
 ELSIF NEW.validation_time_author IS DISTINCT FROM OLD.validation_time_author THEN
  NEW.validation_time_expert:=NULL; NEW.validation_time_apex:=NULL;
  IF OLD.medal_calculated_at IS NOT NULL THEN NEW.medal_due_at:=clock_timestamp(); END IF;
  NEW.medal_calculated_at:=NULL; NEW.medal_calculation_version:=NULL;
  NEW.medal_eligible_pb_count:=0;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER level_item_medal_inputs BEFORE UPDATE OF id_level,validation_time_author ON public.level_item
 FOR EACH ROW EXECUTE FUNCTION zc_private.tg_level_item_medal_inputs();

CREATE OR REPLACE FUNCTION zc_private.refresh_level_medals(level_id integer) RETURNS boolean
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE item public.level_item; previous public.level_item; population record; calculated record; same_author boolean;
BEGIN
 IF NOT pg_try_advisory_xact_lock(1869000001,level_id) THEN RETURN false; END IF;
 SELECT i.* INTO item FROM public.level_item i JOIN public.level l ON l.id=i.id_level
 WHERE i.id_level=level_id AND NOT i.deleted AND i.publicly_visible AND l.publicly_visible AND l.xx_hash IS NOT NULL AND l.xx_hash<>''
 ORDER BY i.updated_at DESC,i.id DESC LIMIT 1 FOR UPDATE OF i;
 IF NOT FOUND THEN
  UPDATE public.level_item SET medal_evaluated_at=clock_timestamp() WHERE id_level=level_id AND medal_due_at IS NOT NULL;
  RETURN true;
 END IF;
 SELECT i.* INTO previous FROM public.level_item i WHERE i.id_level=level_id
 AND (i.medal_qualified_at IS NOT NULL OR i.medal_calculated_at IS NOT NULL OR i.validation_time_expert IS NOT NULL)
 ORDER BY (i.id=item.id) DESC,i.medal_calculated_at DESC NULLS LAST,i.medal_qualified_at DESC NULLS LAST,i.id DESC LIMIT 1 FOR UPDATE;
 IF FOUND AND previous.id<>item.id THEN
  same_author:=zc_private.medal_milliseconds(previous.validation_time_author) IS NOT DISTINCT FROM zc_private.medal_milliseconds(item.validation_time_author);
  item.validation_time_expert:=CASE WHEN same_author THEN previous.validation_time_expert END;
  item.validation_time_apex:=CASE WHEN same_author THEN previous.validation_time_apex END;
  item.medal_qualified_at:=previous.medal_qualified_at;
  item.medal_due_at:=CASE WHEN NOT same_author AND previous.medal_calculated_at IS NOT NULL THEN clock_timestamp() ELSE previous.medal_due_at END;
  item.medal_calculated_at:=CASE WHEN same_author THEN previous.medal_calculated_at END;
  item.medal_calculation_version:=CASE WHEN same_author THEN previous.medal_calculation_version END;
  item.medal_eligible_pb_count:=CASE WHEN same_author THEN previous.medal_eligible_pb_count ELSE 0 END;
  UPDATE public.level_item SET validation_time_expert=NULL,validation_time_apex=NULL,
   medal_qualified_at=NULL,medal_due_at=NULL,medal_calculated_at=NULL,medal_calculation_version=NULL,medal_eligible_pb_count=0
  WHERE id_level=level_id AND id<>item.id AND (medal_qualified_at IS NOT NULL OR medal_calculated_at IS NOT NULL OR validation_time_expert IS NOT NULL);
 END IF;
 IF item.validation_time_expert IS NULL THEN
  SELECT * INTO population FROM zc_private.level_medal_reference(level_id,zc_private.medal_milliseconds(item.validation_time_author));
  item.medal_eligible_pb_count:=population.eligible_count;
  IF item.medal_qualified_at IS NULL AND population.eligible_count>=10 THEN
   item.medal_qualified_at:=clock_timestamp(); item.medal_due_at:=clock_timestamp()+interval '7 days';
  END IF;
  IF item.medal_due_at<=clock_timestamp() AND population.eligible_count>=10 THEN
   SELECT * INTO calculated FROM zc_private.calculate_medal_thresholds(zc_private.medal_milliseconds(item.validation_time_author),population.times);
   IF calculated.expert_ms IS NOT NULL THEN
    item.validation_time_expert:=calculated.expert_ms::double precision/1000;
    item.validation_time_apex:=calculated.apex_ms::double precision/1000;
    item.medal_calculated_at:=clock_timestamp(); item.medal_calculation_version:=1; item.medal_due_at:=NULL;
   END IF;
  END IF;
 END IF;
 IF item.medal_due_at IS NOT NULL THEN item.medal_evaluated_at:=clock_timestamp(); END IF;
 UPDATE public.level_item i SET validation_time_expert=item.validation_time_expert,validation_time_apex=item.validation_time_apex,
  medal_qualified_at=item.medal_qualified_at,medal_due_at=item.medal_due_at,medal_calculated_at=item.medal_calculated_at,
  medal_calculation_version=item.medal_calculation_version,medal_eligible_pb_count=item.medal_eligible_pb_count,medal_evaluated_at=item.medal_evaluated_at
 WHERE i.id=item.id AND ROW(i.validation_time_expert,i.validation_time_apex,i.medal_qualified_at,i.medal_due_at,i.medal_calculated_at,i.medal_calculation_version,i.medal_eligible_pb_count,i.medal_evaluated_at)
 IS DISTINCT FROM ROW(item.validation_time_expert,item.validation_time_apex,item.medal_qualified_at,item.medal_due_at,item.medal_calculated_at,item.medal_calculation_version,item.medal_eligible_pb_count,item.medal_evaluated_at);
 UPDATE public.personal_best_global pb SET medal=classification.medal FROM (
  SELECT r.id,CASE WHEN p.record_eligible AND r.record_eligible AND NOT u.banned THEN
   zc_private.medal_tier(zc_private.medal_milliseconds(r.time),zc_private.medal_milliseconds(item.validation_time_bronze),
    zc_private.medal_milliseconds(item.validation_time_silver),zc_private.medal_milliseconds(item.validation_time_gold),
    zc_private.medal_milliseconds(item.validation_time_author),zc_private.medal_milliseconds(item.validation_time_expert),zc_private.medal_milliseconds(item.validation_time_apex)) END AS medal
  FROM public.record r JOIN public.personal_best_global p ON p.id_record=r.id AND p.id_level=level_id
  JOIN public."user" u ON u.id=r.id_user
 ) classification WHERE pb.id_level=level_id AND pb.id_record=classification.id AND pb.medal IS DISTINCT FROM classification.medal;
 RETURN true;
END $$;

-- The selected item is the only source for all six targets, including backfill reads.
WITH items AS MATERIALIZED (
 SELECT DISTINCT ON(id_level) * FROM public.level_item WHERE NOT deleted AND publicly_visible ORDER BY id_level,updated_at DESC,id DESC
), classifications AS (
 SELECT pb.id,CASE WHEN pb.record_eligible AND r.record_eligible AND NOT u.banned THEN
  zc_private.medal_tier(zc_private.medal_milliseconds(r.time),zc_private.medal_milliseconds(i.validation_time_bronze),
   zc_private.medal_milliseconds(i.validation_time_silver),zc_private.medal_milliseconds(i.validation_time_gold),
   zc_private.medal_milliseconds(i.validation_time_author),zc_private.medal_milliseconds(i.validation_time_expert),zc_private.medal_milliseconds(i.validation_time_apex)) END AS medal
 FROM public.personal_best_global pb JOIN public.record r ON r.id=pb.id_record JOIN public."user" u ON u.id=pb.id_user
 LEFT JOIN items i ON i.id_level=pb.id_level
)
UPDATE public.personal_best_global pb SET medal=c.medal FROM classifications c WHERE c.id=pb.id AND pb.medal IS DISTINCT FROM c.medal;

INSERT INTO public.user_points(id_user,medal_apex,medal_expert,medal_author,medal_gold,medal_silver,medal_bronze,medal_none)
SELECT * FROM zc_private.user_medal_counts(ARRAY(SELECT id FROM public."user"))
ON CONFLICT(id_user) DO UPDATE SET medal_apex=excluded.medal_apex,medal_expert=excluded.medal_expert,
 medal_author=excluded.medal_author,medal_gold=excluded.medal_gold,medal_silver=excluded.medal_silver,
 medal_bronze=excluded.medal_bronze,medal_none=excluded.medal_none
WHERE ROW(user_points.medal_apex,user_points.medal_expert,user_points.medal_author,user_points.medal_gold,user_points.medal_silver,user_points.medal_bronze,user_points.medal_none)
 IS DISTINCT FROM ROW(excluded.medal_apex,excluded.medal_expert,excluded.medal_author,excluded.medal_gold,excluded.medal_silver,excluded.medal_bronze,excluded.medal_none);

DROP TABLE zc_private.level_medal_revision;
DROP TABLE public.level_medal_threshold;
REVOKE ALL ON FUNCTION zc_private.medal_milliseconds(double precision),zc_private.level_medal_reference(integer,bigint),zc_private.tg_level_item_medal_inputs() FROM PUBLIC;
REVOKE ALL ON FUNCTION zc_private.medal_tier(bigint,bigint,bigint,bigint,bigint,bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zc_private.medal_milliseconds(double precision),zc_private.medal_tier(bigint,bigint,bigint,bigint,bigint,bigint,bigint) TO zeepcentraal_graphql;
