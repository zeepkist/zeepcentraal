SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '300s';

CREATE FUNCTION zc_private.medal_milliseconds(seconds real) RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN seconds>0 AND seconds<1e12 THEN floor(seconds::double precision*1000+0.5)::bigint END
$$;
CREATE FUNCTION zc_private.calculate_medal_thresholds(author_ms bigint, times bigint[])
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

ALTER TABLE public.personal_best_global ADD COLUMN medal smallint CHECK(medal BETWEEN 0 AND 5);
COMMENT ON COLUMN public.personal_best_global.medal IS 'Highest medal: bronze=0, silver=1, gold=2, author=3, expert=4, apex=5; null means none.';
ALTER TABLE public.user_points
 ADD COLUMN medal_apex integer NOT NULL DEFAULT 0,
 ADD COLUMN medal_expert integer NOT NULL DEFAULT 0,
 ADD COLUMN medal_author integer NOT NULL DEFAULT 0,
 ADD COLUMN medal_gold integer NOT NULL DEFAULT 0,
 ADD COLUMN medal_silver integer NOT NULL DEFAULT 0,
 ADD COLUMN medal_bronze integer NOT NULL DEFAULT 0,
 ADD COLUMN medal_none integer NOT NULL DEFAULT 0;
CREATE INDEX user_points_medal_apex ON public.user_points(medal_apex DESC,id_user);
CREATE INDEX user_points_medal_expert ON public.user_points(medal_expert DESC,id_user);
CREATE INDEX user_points_medal_author ON public.user_points(medal_author DESC,id_user);
CREATE INDEX user_points_medal_gold ON public.user_points(medal_gold DESC,id_user);
CREATE INDEX user_points_medal_silver ON public.user_points(medal_silver DESC,id_user);
CREATE INDEX user_points_medal_bronze ON public.user_points(medal_bronze DESC,id_user);

-- Migration backfill finalises existing qualifying levels immediately.
-- One materialised statement supplies both targets and their audit snapshot.
WITH candidates AS MATERIALIZED (
SELECT l.id AS id_level,l.xx_hash AS content_hash,i.id AS source_item_id,m.author_ms,m.gold_ms,m.silver_ms,m.bronze_ms,
 c.expert_ms,c.apex_ms,r.eligible_count,r.reference_records
FROM public.level l
JOIN LATERAL(SELECT * FROM public.level_item i WHERE i.id_level=l.id AND NOT i.deleted AND i.publicly_visible ORDER BY i.updated_at DESC,i.id DESC LIMIT 1) i ON true
CROSS JOIN LATERAL(SELECT zc_private.medal_milliseconds(i.validation_time_author) AS author_ms,
 zc_private.medal_milliseconds(i.validation_time_gold) AS gold_ms,zc_private.medal_milliseconds(i.validation_time_silver) AS silver_ms,
 zc_private.medal_milliseconds(i.validation_time_bronze) AS bronze_ms) m
CROSS JOIN LATERAL zc_private.level_medal_reference(l.id,m.author_ms) r
CROSS JOIN LATERAL zc_private.calculate_medal_thresholds(m.author_ms,r.times) c
WHERE l.publicly_visible AND l.xx_hash IS NOT NULL AND l.xx_hash<>''
), inserted AS (
 INSERT INTO public.level_medal_threshold(id_level,source_item_id,author_ms,gold_ms,silver_ms,bronze_ms,
  qualified_at,due_at,expert_ms,apex_ms,revision,eligible_pb_count,calculated_at)
 SELECT id_level,source_item_id,author_ms,gold_ms,silver_ms,bronze_ms,
  CASE WHEN eligible_count>=10 THEN clock_timestamp() END,
  CASE WHEN eligible_count>=10 AND expert_ms IS NULL THEN clock_timestamp() END,
  expert_ms,apex_ms,CASE WHEN expert_ms IS NOT NULL THEN 1 ELSE 0 END,eligible_count,
  CASE WHEN expert_ms IS NOT NULL THEN clock_timestamp() END
 FROM candidates RETURNING id_level,revision,calculated_at
)
INSERT INTO zc_private.level_medal_revision(id_level,revision,content_hash,source_item_id,author_ms,expert_ms,apex_ms,eligible_pb_count,calculated_at,reason,reference_records)
SELECT c.id_level,i.revision,c.content_hash,c.source_item_id,c.author_ms,c.expert_ms,c.apex_ms,c.eligible_count,i.calculated_at,'backfill',c.reference_records
FROM candidates c JOIN inserted i USING(id_level) WHERE i.revision>0;

CREATE FUNCTION zc_private.medal_tier(time_ms bigint,bronze_ms bigint,silver_ms bigint,gold_ms bigint,author_ms bigint,expert_ms bigint,apex_ms bigint)
RETURNS smallint LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN time_ms>0 THEN CASE
 WHEN time_ms<=apex_ms THEN 5 WHEN time_ms<=expert_ms THEN 4
 WHEN time_ms<=author_ms THEN 3 WHEN time_ms<=gold_ms THEN 2
 WHEN time_ms<=silver_ms THEN 1 WHEN time_ms<=bronze_ms THEN 0 END END::smallint
$$;

CREATE FUNCTION public.record_medal(record public.record) RETURNS smallint
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
-- Classify the full backfill in one join, rather than one item lookup per PB.
UPDATE public.personal_best_global pb SET medal=zc_private.medal_tier(zc_private.medal_milliseconds(r.time),t.bronze_ms,t.silver_ms,t.gold_ms,t.author_ms,t.expert_ms,t.apex_ms)
FROM public.record r JOIN public."user" u ON u.id=r.id_user AND NOT u.banned
JOIN public.level_medal_threshold t ON t.id_level=r.id_level
WHERE r.id=pb.id_record AND pb.record_eligible AND r.record_eligible
AND pb.medal IS DISTINCT FROM zc_private.medal_tier(zc_private.medal_milliseconds(r.time),t.bronze_ms,t.silver_ms,t.gold_ms,t.author_ms,t.expert_ms,t.apex_ms);

CREATE FUNCTION zc_private.user_medal_counts(users integer[])
RETURNS TABLE(id_user integer,apex integer,expert integer,author integer,gold integer,silver integer,bronze integer,"none" integer)
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT target.id,count(*) FILTER(WHERE pb.medal=5)::integer,count(*) FILTER(WHERE pb.medal=4)::integer,
 count(*) FILTER(WHERE pb.medal=3)::integer,count(*) FILTER(WHERE pb.medal=2)::integer,
 count(*) FILTER(WHERE pb.medal=1)::integer,count(*) FILTER(WHERE pb.medal=0)::integer,
 count(pb.id) FILTER(WHERE pb.medal IS NULL)::integer
 FROM (SELECT DISTINCT unnest(users) AS id) target JOIN public."user" u ON u.id=target.id
 LEFT JOIN public.personal_best_global pb ON pb.id_user=target.id AND pb.record_eligible AND NOT u.banned
 AND EXISTS(SELECT 1 FROM public.level l WHERE l.id=pb.id_level AND l.publicly_visible)
 AND EXISTS(SELECT 1 FROM public.level_item i WHERE i.id_level=pb.id_level AND NOT i.deleted AND i.publicly_visible)
 GROUP BY target.id
$$;
INSERT INTO public.user_points(id_user,medal_apex,medal_expert,medal_author,medal_gold,medal_silver,medal_bronze,medal_none)
SELECT * FROM zc_private.user_medal_counts(ARRAY(SELECT id FROM public."user"))
ON CONFLICT(id_user) DO UPDATE SET medal_apex=excluded.medal_apex,medal_expert=excluded.medal_expert,
 medal_author=excluded.medal_author,medal_gold=excluded.medal_gold,medal_silver=excluded.medal_silver,
 medal_bronze=excluded.medal_bronze,medal_none=excluded.medal_none;

CREATE FUNCTION public.medal_counts(user_id integer DEFAULT NULL,steam_id bigint DEFAULT NULL,discord_id bigint DEFAULT NULL)
RETURNS TABLE(apex bigint,expert bigint,author bigint,gold bigint,silver bigint,bronze bigint,"none" bigint)
LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
BEGIN
 IF num_nonnulls(user_id,steam_id,discord_id)>1 THEN
  RAISE EXCEPTION 'Provide at most one user identifier' USING ERRCODE='22023';
 END IF;
 RETURN QUERY SELECT coalesce(sum(p.medal_apex),0)::bigint,coalesce(sum(p.medal_expert),0)::bigint,
 coalesce(sum(p.medal_author),0)::bigint,coalesce(sum(p.medal_gold),0)::bigint,
 coalesce(sum(p.medal_silver),0)::bigint,coalesce(sum(p.medal_bronze),0)::bigint,coalesce(sum(p.medal_none),0)::bigint
 FROM public.user_points p JOIN public."user" u ON u.id=p.id_user AND NOT u.banned
 WHERE ($1 IS NULL OR u.id=$1) AND ($2 IS NULL OR u.steam_id=$2)
 AND ($3 IS NULL OR u.discord_id=$3);
END $$;

CREATE FUNCTION public.record_history_entry_medal(entry public.record_history_entry) RETURNS smallint
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT public.record_medal(r) FROM public.record r WHERE r.id=entry.id
$$;

CREATE FUNCTION zc_private.refresh_level_medals(level_id integer) RETURNS boolean
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

CREATE FUNCTION zc_private.tg_pb_medal() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 SELECT public.record_medal(r) INTO NEW.medal FROM public.record r WHERE r.id=NEW.id_record;
 RETURN NEW;
END $$;
CREATE TRIGGER pb_medal BEFORE INSERT OR UPDATE OF id_record,record_eligible ON public.personal_best_global
 FOR EACH ROW EXECUTE FUNCTION zc_private.tg_pb_medal();

-- Statement transitions avoid one queue operation per PB during reclassification.
CREATE FUNCTION zc_private.tg_medal_pb_refresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target integer;
BEGIN
 IF TG_OP='UPDATE' THEN
  FOR target IN SELECT DISTINCT id_level FROM (
   (SELECT id_level,id_user,id_record,record_eligible FROM new_medals EXCEPT SELECT id_level,id_user,id_record,record_eligible FROM old_medals)
   UNION (SELECT id_level,id_user,id_record,record_eligible FROM old_medals EXCEPT SELECT id_level,id_user,id_record,record_eligible FROM new_medals)
  ) changes LOOP
   PERFORM zc_jobs.enqueue('bulk','refreshMedals',jsonb_build_object('idLevel',target),'refresh-medals:'||target,'medals:'||target,3,clock_timestamp());
  END LOOP;
  FOR target IN SELECT DISTINCT id_user FROM (
   (SELECT id_user,medal,record_eligible,id_level FROM new_medals EXCEPT SELECT id_user,medal,record_eligible,id_level FROM old_medals)
   UNION (SELECT id_user,medal,record_eligible,id_level FROM old_medals EXCEPT SELECT id_user,medal,record_eligible,id_level FROM new_medals)
  ) changes LOOP
   PERFORM zc_jobs.enqueue('bulk','updatePlayerScore',jsonb_build_object('idUser',target),'update-player-score:'||target,'global-scores',3,clock_timestamp());
  END LOOP;
 ELSE
  IF TG_OP='INSERT' THEN
   FOR target IN SELECT DISTINCT id_level FROM new_medals LOOP
    PERFORM zc_jobs.enqueue('bulk','refreshMedals',jsonb_build_object('idLevel',target),'refresh-medals:'||target,'medals:'||target,3,clock_timestamp());
   END LOOP;
  ELSE
   FOR target IN SELECT DISTINCT id_level FROM old_medals LOOP
    PERFORM zc_jobs.enqueue('bulk','refreshMedals',jsonb_build_object('idLevel',target),'refresh-medals:'||target,'medals:'||target,3,clock_timestamp());
   END LOOP;
  END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER medal_pb_insert AFTER INSERT ON public.personal_best_global REFERENCING NEW TABLE AS new_medals FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_medal_pb_refresh();
CREATE TRIGGER medal_pb_update AFTER UPDATE ON public.personal_best_global REFERENCING OLD TABLE AS old_medals NEW TABLE AS new_medals FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_medal_pb_refresh();
CREATE TRIGGER medal_pb_delete AFTER DELETE ON public.personal_best_global REFERENCING OLD TABLE AS old_medals FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_medal_pb_refresh();

CREATE FUNCTION zc_private.tg_medal_metadata_refresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target integer; availability_changed boolean;
BEGIN
 IF TG_TABLE_NAME='user' THEN
  PERFORM zc_jobs.enqueue('bulk','updatePlayerScore',jsonb_build_object('idUser',NEW.id),'update-player-score:'||NEW.id,'global-scores',3,clock_timestamp());
  FOR target IN SELECT DISTINCT id_level FROM public.personal_best_global WHERE id_user=NEW.id LOOP
   PERFORM zc_jobs.enqueue('bulk','refreshMedals',jsonb_build_object('idLevel',target),'refresh-medals:'||target,'medals:'||target,3,clock_timestamp());
  END LOOP;
 ELSIF TG_TABLE_NAME='level' THEN
  target:=NEW.id;
  PERFORM zc_jobs.enqueue('bulk','refreshMedals',jsonb_build_object('idLevel',target),'refresh-medals:'||target,'medals:'||target,3,clock_timestamp());
  PERFORM zc_jobs.enqueue('bulk','updateLevelRecordCounts',jsonb_build_object('idLevel',target,'afterUserId',0),'update-level-record-counts:'||target||':0','level-record-counts:'||target,3,clock_timestamp());
 ELSE
  availability_changed:=true;
  IF TG_OP='UPDATE' THEN
   availability_changed:=ROW(OLD.id_level,OLD.deleted,OLD.publicly_visible) IS DISTINCT FROM ROW(NEW.id_level,NEW.deleted,NEW.publicly_visible);
  END IF;
  IF TG_OP<>'INSERT' THEN
   target:=OLD.id_level;
   PERFORM zc_jobs.enqueue('bulk','refreshMedals',jsonb_build_object('idLevel',target),'refresh-medals:'||target,'medals:'||target,3,clock_timestamp());
   IF availability_changed THEN
    PERFORM zc_jobs.enqueue('bulk','updateLevelRecordCounts',jsonb_build_object('idLevel',target,'afterUserId',0),'update-level-record-counts:'||target||':0','level-record-counts:'||target,3,clock_timestamp());
   END IF;
  END IF;
  IF TG_OP<>'DELETE' THEN
   target:=NEW.id_level;
   PERFORM zc_jobs.enqueue('bulk','refreshMedals',jsonb_build_object('idLevel',target),'refresh-medals:'||target,'medals:'||target,3,clock_timestamp());
   IF availability_changed THEN
    PERFORM zc_jobs.enqueue('bulk','updateLevelRecordCounts',jsonb_build_object('idLevel',target,'afterUserId',0),'update-level-record-counts:'||target||':0','level-record-counts:'||target,3,clock_timestamp());
   END IF;
  END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER medal_item_refresh AFTER INSERT OR DELETE OR UPDATE OF id_level,validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,updated_at,deleted,publicly_visible ON public.level_item FOR EACH ROW EXECUTE FUNCTION zc_private.tg_medal_metadata_refresh();
CREATE TRIGGER medal_level_refresh AFTER UPDATE OF publicly_visible,xx_hash ON public.level FOR EACH ROW EXECUTE FUNCTION zc_private.tg_medal_metadata_refresh();
CREATE TRIGGER medal_ban_refresh AFTER UPDATE OF banned ON public."user" FOR EACH ROW WHEN(OLD.banned IS DISTINCT FROM NEW.banned) EXECUTE FUNCTION zc_private.tg_medal_metadata_refresh();

CREATE TRIGGER trg__live_query_invalidate AFTER INSERT OR UPDATE OR DELETE ON public.level_medal_threshold
 FOR EACH STATEMENT EXECUTE FUNCTION public.tg__live_query_invalidate();

REVOKE ALL ON public.level_medal_threshold,zc_private.level_medal_revision FROM PUBLIC;
GRANT SELECT ON public.level_medal_threshold TO zeepcentraal_graphql;
REVOKE ALL ON FUNCTION public.record_medal(public.record),public.record_history_entry_medal(public.record_history_entry),public.medal_counts(integer,bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_medal(public.record),public.record_history_entry_medal(public.record_history_entry),public.medal_counts(integer,bigint,bigint) TO zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.medal_milliseconds(real),zc_private.calculate_medal_thresholds(bigint,bigint[]),zc_private.level_medal_reference(integer,bigint),zc_private.user_medal_counts(integer[]),zc_private.refresh_level_medals(integer),zc_private.tg_pb_medal(),zc_private.tg_medal_pb_refresh(),zc_private.tg_medal_metadata_refresh() FROM PUBLIC;
REVOKE ALL ON FUNCTION zc_private.medal_tier(bigint,bigint,bigint,bigint,bigint,bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zc_private.medal_milliseconds(real),zc_private.medal_tier(bigint,bigint,bigint,bigint,bigint,bigint,bigint) TO zeepcentraal_graphql;
