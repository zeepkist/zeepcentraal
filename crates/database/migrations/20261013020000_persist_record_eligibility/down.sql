-- Restore validation-backed reads before removing cached eligibility state.
LOCK TABLE public.level, public.record, public.record_media, public.record_statistic,
 public.personal_best_global, public.world_record_global, public.user_point_contribution,
 zc_private.record_history_index, zc_private.record_validation IN SHARE ROW EXCLUSIVE MODE;

ALTER POLICY record_eligibility ON public.record USING(NOT EXISTS(
 SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=record.id AND v.status='fail'));
ALTER POLICY record_eligibility ON public.record_media USING(NOT EXISTS(
 SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=record_media.id_record AND v.status='fail'));
ALTER POLICY record_eligibility ON public.record_statistic USING(NOT EXISTS(
 SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=record_statistic.id_record AND v.status='fail'));
ALTER POLICY record_eligibility ON public.personal_best_global USING(NOT EXISTS(
 SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=personal_best_global.id_record AND v.status='fail'));
ALTER POLICY record_eligibility ON public.world_record_global USING(NOT EXISTS(
 SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=world_record_global.id_record AND v.status='fail'));
ALTER POLICY record_eligibility ON public.user_point_contribution USING(NOT EXISTS(
 SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=user_point_contribution.id_record AND v.status='fail'));
ALTER POLICY record_eligibility ON zc_private.record_history_index USING(NOT EXISTS(
 SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=record_history_index.id AND v.status='fail'));
CREATE OR REPLACE FUNCTION zc_private.record_is_eligible(p_record integer) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT NOT EXISTS(SELECT 1 FROM zc_private.record_validation WHERE id_record=p_record AND status='fail')
$$;

CREATE OR REPLACE FUNCTION zc_private.tg_record_validation_eligibility() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE changed record;
BEGIN
 IF TG_OP='INSERT' THEN
  FOR changed IN SELECT r.id_level,count(*)::bigint AS failures FROM new_validations n
   JOIN public.record r ON r.id=n.id_record WHERE n.status='fail' GROUP BY r.id_level ORDER BY r.id_level
  LOOP
   UPDATE public.level SET record_count=greatest(0,record_count-changed.failures) WHERE id=changed.id_level;
   PERFORM zc_private.schedule_record_eligibility(changed.id_level);
  END LOOP;
 ELSIF TG_OP='DELETE' THEN
  FOR changed IN SELECT r.id_level,count(*)::bigint AS failures FROM old_validations o
   JOIN public.record r ON r.id=o.id_record WHERE o.status='fail' GROUP BY r.id_level ORDER BY r.id_level
  LOOP
   UPDATE public.level SET record_count=record_count+changed.failures WHERE id=changed.id_level;
   PERFORM zc_private.schedule_record_eligibility(changed.id_level);
  END LOOP;
 ELSE
  FOR changed IN SELECT r.id_level,sum((n.status='fail')::integer-(o.status='fail')::integer)::bigint AS failures
   FROM new_validations n JOIN old_validations o USING(id_record) JOIN public.record r ON r.id=n.id_record
   WHERE (n.status='fail') IS DISTINCT FROM (o.status='fail') GROUP BY r.id_level ORDER BY r.id_level
  LOOP
   UPDATE public.level SET record_count=greatest(0,record_count-changed.failures) WHERE id=changed.id_level;
   PERFORM zc_private.schedule_record_eligibility(changed.id_level);
  END LOOP;
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_record_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_records(
		ARRAY(
			SELECT id FROM old_records
			UNION
			SELECT id FROM new_records
		)
	);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_relation_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_records(
		ARRAY(
			SELECT id_record FROM old_relations
			UNION
			SELECT id_record FROM new_relations
		)
	);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_contribution_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_contributions(
		ARRAY(
			SELECT id_record FROM old_contributions
			UNION
			SELECT id_record FROM new_contributions
		)
	);
	RETURN NULL;
END;
$$;

ALTER TABLE public.record_media DROP CONSTRAINT record_media_eligibility_fkey;
ALTER TABLE public.record_statistic DROP CONSTRAINT record_statistic_eligibility_fkey;
ALTER TABLE public.personal_best_global DROP CONSTRAINT personal_best_global_eligibility_fkey;
ALTER TABLE public.world_record_global DROP CONSTRAINT world_record_global_eligibility_fkey;
ALTER TABLE public.user_point_contribution DROP CONSTRAINT user_point_contribution_eligibility_fkey;
ALTER TABLE zc_private.record_history_index DROP CONSTRAINT record_history_index_eligibility_fkey;
DROP TRIGGER initialize_record_eligibility ON public.record;
DROP TRIGGER initialize_record_eligibility ON public.record_media;
DROP TRIGGER initialize_record_eligibility ON public.record_statistic;
DROP TRIGGER initialize_record_eligibility ON public.personal_best_global;
DROP TRIGGER initialize_record_eligibility ON public.world_record_global;
DROP TRIGGER initialize_record_eligibility ON public.user_point_contribution;
DROP TRIGGER initialize_record_eligibility ON zc_private.record_history_index;
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
				record_count = record_count + (zc_private.record_is_eligible(NEW.id))::integer,
				has_records = true
			WHERE id = affected_level_id;
		ELSE
			UPDATE public.level
			SET record_count = GREATEST(record_count - (zc_private.record_is_eligible(OLD.id))::integer, 0)
			WHERE id = affected_level_id;
		END IF;
	END LOOP;

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$;

DROP FUNCTION zc_private.tg_initialize_record_eligibility();
ALTER TABLE public.record DROP CONSTRAINT record_eligibility_identity;
DROP INDEX public.records_eligible_id;
DROP INDEX public.records_eligible_date_level;
DROP INDEX public.record_statistics_eligible_distance;
ALTER TABLE public.record DROP COLUMN record_eligible;
ALTER TABLE public.record_media DROP COLUMN record_eligible;
ALTER TABLE public.record_statistic DROP COLUMN record_eligible;
ALTER TABLE public.personal_best_global DROP COLUMN record_eligible;
ALTER TABLE public.world_record_global DROP COLUMN record_eligible;
ALTER TABLE public.user_point_contribution DROP COLUMN record_eligible;
ALTER TABLE zc_private.record_history_index DROP COLUMN record_eligible;
