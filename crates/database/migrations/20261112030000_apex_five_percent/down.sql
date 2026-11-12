SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '300s';

-- Keep reference inputs and derived counts consistent throughout this transaction.
LOCK TABLE public."user",public.level,public.level_item,public.record,
 public.personal_best_global,public.user_points IN SHARE ROW EXCLUSIVE MODE;

-- Restore 15% policy using current eligible PBs. Historical snapshots are not retained.
CREATE OR REPLACE FUNCTION zc_private.calculate_medal_thresholds(author_ms bigint, times bigint[])
RETURNS TABLE(expert_ms bigint,apex_ms bigint)
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $$
 WITH ranked AS (
  SELECT t,row_number() OVER(ORDER BY t) AS position FROM unnest(times) t WHERE t>0 AND t<author_ms
 ), reference AS (
  SELECT count(*) AS population,min(t) AS fastest,
   floor((11*sum(t)+90*author_ms)/200)::bigint AS expert,
   floor((17*sum(t*(ARRAY[20,18,16,14,10,8,5,4,3,2]::bigint[])[position::integer])+300*author_ms)/2000)::bigint AS apex
  FROM ranked WHERE position<=10
 ) SELECT CASE WHEN population=10 AND fastest<=apex AND apex<expert AND expert<author_ms THEN expert END,
          CASE WHEN population=10 AND fastest<=apex AND apex<expert AND expert<author_ms THEN apex END FROM reference
$$;

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

-- One explicit rebalance. Expert and all four base times remain frozen.
DO $$
DECLARE item public.level_item; population record; calculated record;
BEGIN
 FOR item IN SELECT * FROM public.level_item
  WHERE validation_time_apex IS NOT NULL AND medal_calculation_version IS DISTINCT FROM 1
  ORDER BY id_level,id
 LOOP
  SELECT * INTO population FROM zc_private.level_medal_reference(item.id_level,zc_private.medal_milliseconds(item.validation_time_author));
  IF population.eligible_count<10 THEN
   RAISE EXCEPTION 'Cannot rebalance Apex for level %: fewer than 10 eligible PBs',item.id_level;
  END IF;
  SELECT * INTO calculated FROM zc_private.calculate_medal_thresholds(zc_private.medal_milliseconds(item.validation_time_author),population.times);
  IF calculated.apex_ms IS NULL OR calculated.apex_ms>=zc_private.medal_milliseconds(item.validation_time_expert) THEN
   RAISE EXCEPTION 'Cannot rebalance Apex for level %: invalid threshold pair',item.id_level;
  END IF;
  UPDATE public.level_item SET validation_time_apex=calculated.apex_ms::double precision/1000,
   medal_calculation_version=1,medal_calculated_at=transaction_timestamp(),
   medal_eligible_pb_count=population.eligible_count,medal_evaluated_at=transaction_timestamp()
  WHERE id=item.id;
 END LOOP;
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

