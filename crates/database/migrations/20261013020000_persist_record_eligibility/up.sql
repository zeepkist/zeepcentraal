-- Transactional maintenance migration. Pause API/job writers before applying.
-- ALTER TABLE keeps ACCESS EXCLUSIVE locks until commit; GraphQL reads also wait.
-- Validation status remains authoritative. Cached flags only remove read-time lookups.
LOCK TABLE public.level, public.record, public.record_media, public.record_statistic,
 public.personal_best_global, public.world_record_global, public.user_point_contribution,
 zc_private.record_history_index, zc_private.record_validation IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.record ADD COLUMN record_eligible boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.record.record_eligible IS E'@omit\n@behavior -aggregate -groupBy -havingBy';
ALTER TABLE public.record_media ADD COLUMN record_eligible boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.record_media.record_eligible IS E'@omit\n@behavior -aggregate -groupBy -havingBy';
ALTER TABLE public.record_statistic ADD COLUMN record_eligible boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.record_statistic.record_eligible IS E'@omit\n@behavior -aggregate -groupBy -havingBy';
ALTER TABLE public.personal_best_global ADD COLUMN record_eligible boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.personal_best_global.record_eligible IS E'@omit\n@behavior -aggregate -groupBy -havingBy';
ALTER TABLE public.world_record_global ADD COLUMN record_eligible boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.world_record_global.record_eligible IS E'@omit\n@behavior -aggregate -groupBy -havingBy';
ALTER TABLE public.user_point_contribution ADD COLUMN record_eligible boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.user_point_contribution.record_eligible IS E'@omit\n@behavior -aggregate -groupBy -havingBy';
ALTER TABLE zc_private.record_history_index ADD COLUMN record_eligible boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN zc_private.record_history_index.record_eligible IS E'@omit\n@behavior -aggregate -groupBy -havingBy';

-- Eligibility-only changes must not rebuild the history projection.
CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_record_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE changed_ids integer[];
BEGIN
 SELECT array_agg(DISTINCT changed.id) INTO changed_ids FROM (
  (SELECT id,id_user,id_level,time,date_created FROM old_records
   EXCEPT SELECT id,id_user,id_level,time,date_created FROM new_records)
  UNION
  (SELECT id,id_user,id_level,time,date_created FROM new_records
   EXCEPT SELECT id,id_user,id_level,time,date_created FROM old_records)
 ) changed;
 IF cardinality(changed_ids)>0 THEN
  PERFORM zc_private.sync_record_history_records(changed_ids);
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_relation_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE changed_ids integer[];
BEGIN
 SELECT array_agg(DISTINCT changed.id_record) INTO changed_ids FROM (
  (SELECT id_record,id_user,id_level FROM old_relations
   EXCEPT SELECT id_record,id_user,id_level FROM new_relations)
  UNION
  (SELECT id_record,id_user,id_level FROM new_relations
   EXCEPT SELECT id_record,id_user,id_level FROM old_relations)
 ) changed;
 IF cardinality(changed_ids)>0 THEN
  PERFORM zc_private.sync_record_history_records(changed_ids);
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_contribution_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE changed_ids integer[];
BEGIN
 SELECT array_agg(DISTINCT changed.id_record) INTO changed_ids FROM (
  (SELECT id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points FROM old_contributions
   EXCEPT SELECT id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points FROM new_contributions)
  UNION
  (SELECT id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points FROM new_contributions
   EXCEPT SELECT id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points FROM old_contributions)
 ) changed;
 IF cardinality(changed_ids)>0 THEN
  PERFORM zc_private.sync_record_history_contributions(changed_ids);
 END IF;
 RETURN NULL;
END $$;

UPDATE public.record r SET record_eligible=false
FROM zc_private.record_validation v WHERE v.id_record=r.id AND v.status='fail';
UPDATE public.record_media target SET record_eligible=false
FROM public.record r WHERE r.id=target.id_record AND NOT r.record_eligible;
UPDATE public.record_statistic target SET record_eligible=false
FROM public.record r WHERE r.id=target.id_record AND NOT r.record_eligible;
UPDATE public.personal_best_global target SET record_eligible=false
FROM public.record r WHERE r.id=target.id_record AND NOT r.record_eligible;
UPDATE public.world_record_global target SET record_eligible=false
FROM public.record r WHERE r.id=target.id_record AND NOT r.record_eligible;
UPDATE public.user_point_contribution target SET record_eligible=false
FROM public.record r WHERE r.id=target.id_record AND NOT r.record_eligible;
UPDATE zc_private.record_history_index target SET record_eligible=false
FROM public.record r WHERE r.id=target.id AND NOT r.record_eligible;

-- Hidden composite keys enforce equality even across concurrent validation/child writes.
ALTER TABLE public.record ADD CONSTRAINT record_eligibility_identity UNIQUE(id,record_eligible);
COMMENT ON CONSTRAINT record_eligibility_identity ON public.record IS '@omit';

CREATE FUNCTION zc_private.tg_initialize_record_eligibility() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='record' THEN
  -- This also prevents explicit eligibility writes from overriding current validation.
  NEW.record_eligible := NOT EXISTS(
   SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=NEW.id AND v.status='fail');
 ELSE
  -- KEY SHARE serializes against updates of the referenced composite eligibility key.
  IF TG_TABLE_NAME='record_history_index' THEN
   SELECT r.record_eligible INTO STRICT NEW.record_eligible FROM public.record r WHERE r.id=NEW.id FOR KEY SHARE;
  ELSE
   SELECT r.record_eligible INTO STRICT NEW.record_eligible FROM public.record r WHERE r.id=NEW.id_record FOR KEY SHARE;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION zc_private.tg_initialize_record_eligibility() FROM PUBLIC,zeepcentraal_graphql;
CREATE TRIGGER initialize_record_eligibility BEFORE INSERT OR UPDATE OF id,record_eligible
 ON public.record FOR EACH ROW EXECUTE FUNCTION zc_private.tg_initialize_record_eligibility();
CREATE TRIGGER initialize_record_eligibility BEFORE INSERT OR UPDATE OF id_record,record_eligible
 ON public.record_media FOR EACH ROW EXECUTE FUNCTION zc_private.tg_initialize_record_eligibility();
ALTER TABLE public.record_media ADD CONSTRAINT record_media_eligibility_fkey
 FOREIGN KEY(id_record,record_eligible) REFERENCES public.record(id,record_eligible) ON DELETE CASCADE ON UPDATE CASCADE;
COMMENT ON CONSTRAINT record_media_eligibility_fkey ON public.record_media IS '@omit';
CREATE TRIGGER initialize_record_eligibility BEFORE INSERT OR UPDATE OF id_record,record_eligible
 ON public.record_statistic FOR EACH ROW EXECUTE FUNCTION zc_private.tg_initialize_record_eligibility();
ALTER TABLE public.record_statistic ADD CONSTRAINT record_statistic_eligibility_fkey
 FOREIGN KEY(id_record,record_eligible) REFERENCES public.record(id,record_eligible) ON DELETE CASCADE ON UPDATE CASCADE;
COMMENT ON CONSTRAINT record_statistic_eligibility_fkey ON public.record_statistic IS '@omit';
CREATE TRIGGER initialize_record_eligibility BEFORE INSERT OR UPDATE OF id_record,record_eligible
 ON public.personal_best_global FOR EACH ROW EXECUTE FUNCTION zc_private.tg_initialize_record_eligibility();
ALTER TABLE public.personal_best_global ADD CONSTRAINT personal_best_global_eligibility_fkey
 FOREIGN KEY(id_record,record_eligible) REFERENCES public.record(id,record_eligible) ON DELETE CASCADE ON UPDATE CASCADE;
COMMENT ON CONSTRAINT personal_best_global_eligibility_fkey ON public.personal_best_global IS '@omit';
CREATE TRIGGER initialize_record_eligibility BEFORE INSERT OR UPDATE OF id_record,record_eligible
 ON public.world_record_global FOR EACH ROW EXECUTE FUNCTION zc_private.tg_initialize_record_eligibility();
ALTER TABLE public.world_record_global ADD CONSTRAINT world_record_global_eligibility_fkey
 FOREIGN KEY(id_record,record_eligible) REFERENCES public.record(id,record_eligible) ON DELETE CASCADE ON UPDATE CASCADE;
COMMENT ON CONSTRAINT world_record_global_eligibility_fkey ON public.world_record_global IS '@omit';
CREATE TRIGGER initialize_record_eligibility BEFORE INSERT OR UPDATE OF id_record,record_eligible
 ON public.user_point_contribution FOR EACH ROW EXECUTE FUNCTION zc_private.tg_initialize_record_eligibility();
ALTER TABLE public.user_point_contribution ADD CONSTRAINT user_point_contribution_eligibility_fkey
 FOREIGN KEY(id_record,record_eligible) REFERENCES public.record(id,record_eligible) ON DELETE CASCADE ON UPDATE CASCADE;
COMMENT ON CONSTRAINT user_point_contribution_eligibility_fkey ON public.user_point_contribution IS '@omit';
CREATE TRIGGER initialize_record_eligibility BEFORE INSERT OR UPDATE OF id,record_eligible
 ON zc_private.record_history_index FOR EACH ROW EXECUTE FUNCTION zc_private.tg_initialize_record_eligibility();
ALTER TABLE zc_private.record_history_index ADD CONSTRAINT record_history_index_eligibility_fkey
 FOREIGN KEY(id,record_eligible) REFERENCES public.record(id,record_eligible) ON DELETE CASCADE ON UPDATE CASCADE;
COMMENT ON CONSTRAINT record_history_index_eligibility_fkey ON zc_private.record_history_index IS '@omit';

CREATE OR REPLACE FUNCTION zc_private.tg_record_validation_eligibility() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE affected_ids integer[]; changed record;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT array_agg(id_record) INTO affected_ids FROM new_validations WHERE status='fail';
 ELSIF TG_OP='DELETE' THEN
  SELECT array_agg(id_record) INTO affected_ids FROM old_validations WHERE status='fail';
 ELSE
  -- Compare eligibility semantics, not mutable validation metadata or row identity.
  -- A changed record reference restores the old record and gates the new record.
  SELECT array_agg(DISTINCT id_record) INTO affected_ids FROM (
   (SELECT id_record,(status='fail') AS failed FROM old_validations
    EXCEPT SELECT id_record,(status='fail') FROM new_validations)
   UNION
   (SELECT id_record,(status='fail') FROM new_validations
    EXCEPT SELECT id_record,(status='fail') FROM old_validations)
  ) transitions;
 END IF;
 IF coalesce(cardinality(affected_ids),0)=0 THEN RETURN NULL; END IF;

 -- Keep established Level-before-Record lock order and one queue write per changed level.
 FOR changed IN
  SELECT r.id_level,sum((NOT EXISTS(SELECT 1 FROM zc_private.record_validation v
   WHERE v.id_record=r.id AND v.status='fail'))::integer-r.record_eligible::integer)::bigint AS delta
  FROM public.record r WHERE r.id=ANY(affected_ids)
   AND r.record_eligible IS DISTINCT FROM (NOT EXISTS(SELECT 1 FROM zc_private.record_validation v
    WHERE v.id_record=r.id AND v.status='fail'))
  GROUP BY r.id_level ORDER BY r.id_level
 LOOP
  UPDATE public.level SET record_count=greatest(0,record_count+changed.delta) WHERE id=changed.id_level;
  PERFORM zc_private.schedule_record_eligibility(changed.id_level);
 END LOOP;
 PERFORM r.id FROM public.record r WHERE r.id=ANY(affected_ids) ORDER BY r.id FOR UPDATE OF r;

 -- Composite foreign keys cascade flags without changing record evidence or notifications.
 UPDATE public.record r SET record_eligible=NOT EXISTS(SELECT 1 FROM zc_private.record_validation v
  WHERE v.id_record=r.id AND v.status='fail')
 WHERE r.id=ANY(affected_ids) AND r.record_eligible IS DISTINCT FROM
  (NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=r.id AND v.status='fail'));
 RETURN NULL;
END $$;

-- Deleted records no longer exist for helper lookup; use trigger row flags for exact counts.
CREATE OR REPLACE FUNCTION zc_private.tg_sync_level_record_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
	source_level_id integer;
	target_level_id integer;
	target_has_records boolean;
	affected_level_id integer;
	affected_workshop_id bigint;
BEGIN
	IF TG_OP = 'INSERT' THEN
		target_level_id := NEW.id_level;
	ELSIF TG_OP = 'DELETE' THEN
		source_level_id := OLD.id_level;
	ELSIF OLD.id_level IS DISTINCT FROM NEW.id_level THEN
		source_level_id := OLD.id_level;
		target_level_id := NEW.id_level;
	ELSE
		RETURN NEW;
	END IF;

	-- First record changes metadata visibility. Preserve the existing Workshop-before-Level lock
	-- order, and lock aliases deterministically, before setting has_records.
	IF target_level_id IS NOT NULL THEN
		SELECT candidate_level.has_records
		INTO target_has_records
		FROM public.level AS candidate_level
		WHERE candidate_level.id = target_level_id;

		IF target_has_records = false THEN
			FOR affected_workshop_id IN
				SELECT DISTINCT candidate_level_item.workshop_id
				FROM public.level_item AS candidate_level_item
				WHERE candidate_level_item.id_level = target_level_id
				ORDER BY candidate_level_item.workshop_id
			LOOP
				PERFORM candidate_workshop_item.workshop_id
				FROM public.workshop_item AS candidate_workshop_item
				WHERE candidate_workshop_item.workshop_id = affected_workshop_id
				FOR UPDATE OF candidate_workshop_item;
			END LOOP;
		END IF;
	END IF;

	-- Record moves lock both Level rows in ascending order. has_records remains sticky even if
	-- administrative deletion reduces the exact count to zero.
	FOR affected_level_id IN
		SELECT DISTINCT candidate_level.candidate_level_id
		FROM unnest(ARRAY[source_level_id, target_level_id]) AS candidate_level(candidate_level_id)
		WHERE candidate_level.candidate_level_id IS NOT NULL
		ORDER BY candidate_level.candidate_level_id
	LOOP
		IF affected_level_id = target_level_id THEN
			UPDATE public.level
			SET
				record_count = record_count + (NEW.record_eligible)::integer,
				has_records = true
			WHERE id = affected_level_id;
		ELSE
			UPDATE public.level
			SET record_count = GREATEST(record_count - (OLD.record_eligible)::integer, 0)
			WHERE id = affected_level_id;
		END IF;
	END LOOP;

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION zc_private.record_is_eligible(p_record integer) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce((SELECT r.record_eligible FROM public.record r WHERE r.id=p_record),true)
$$;
ALTER POLICY record_eligibility ON public.record USING(record_eligible);
ALTER POLICY record_eligibility ON public.record_media USING(record_eligible);
ALTER POLICY record_eligibility ON public.record_statistic USING(record_eligible);
ALTER POLICY record_eligibility ON public.personal_best_global USING(record_eligible);
ALTER POLICY record_eligibility ON public.world_record_global USING(record_eligible);
ALTER POLICY record_eligibility ON public.user_point_contribution USING(record_eligible);
ALTER POLICY record_eligibility ON zc_private.record_history_index USING(record_eligible);

CREATE INDEX records_eligible_id ON public.record(id) WHERE record_eligible;
CREATE INDEX records_eligible_date_level ON public.record(date_created DESC NULLS LAST,id_level) WHERE record_eligible;
CREATE INDEX record_statistics_eligible_distance ON public.record_statistic(id_record) INCLUDE(distance) WHERE record_eligible;

-- Child equality is checked by validated composite foreign keys. Verify source backfill too.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.record r
  LEFT JOIN zc_private.record_validation v ON v.id_record=r.id AND v.status='fail'
  WHERE r.record_eligible IS DISTINCT FROM (v.id_record IS NULL)) THEN
  RAISE EXCEPTION 'Persisted record eligibility backfill has drift';
 END IF;
END $$;

ANALYZE public.record;
ANALYZE public.record_media;
ANALYZE public.record_statistic;
ANALYZE public.personal_best_global;
ANALYZE public.world_record_global;
ANALYZE public.user_point_contribution;
ANALYZE zc_private.record_history_index;
