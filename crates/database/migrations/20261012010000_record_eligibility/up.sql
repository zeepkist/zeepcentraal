-- Eligibility is derived from the one current validation row. No copied flag.
CREATE FUNCTION zc_private.record_is_eligible(p_record integer) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT NOT EXISTS(SELECT 1 FROM zc_private.record_validation WHERE id_record=p_record AND status='fail')
$$;
REVOKE ALL ON FUNCTION zc_private.record_is_eligible(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zc_private.record_is_eligible(integer) TO zeepcentraal_graphql;

CREATE OR REPLACE FUNCTION zc_private.is_visible_record(p_record_id integer) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.record r WHERE r.id=p_record_id
 AND EXISTS(SELECT 1 FROM public.level l WHERE l.id=r.id_level AND l.publicly_visible)
 AND zc_private.record_is_eligible(r.id))
$$;

-- Retain current level visibility. These policies restrict record evidence only.
ALTER TABLE public.record ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_eligibility ON public.record FOR SELECT TO zeepcentraal_graphql
 USING(zc_private.record_is_eligible(id));
ALTER TABLE public.record_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_eligibility ON public.record_media FOR SELECT TO zeepcentraal_graphql
 USING(zc_private.record_is_eligible(id_record));
ALTER TABLE public.record_statistic ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_eligibility ON public.record_statistic FOR SELECT TO zeepcentraal_graphql
 USING(zc_private.record_is_eligible(id_record));
ALTER TABLE public.personal_best_global ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_eligibility ON public.personal_best_global FOR SELECT TO zeepcentraal_graphql
 USING(zc_private.record_is_eligible(id_record));
ALTER TABLE public.world_record_global ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_eligibility ON public.world_record_global FOR SELECT TO zeepcentraal_graphql
 USING(zc_private.record_is_eligible(id_record));
ALTER TABLE public.user_point_contribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_eligibility ON public.user_point_contribution FOR SELECT TO zeepcentraal_graphql
 USING(zc_private.record_is_eligible(id_record));

CREATE FUNCTION zc_private.schedule_record_eligibility(p_level integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM zc_jobs.enqueue('bulk','reconcileRecordEligibility',jsonb_build_object('idLevel',p_level),
  'record-eligibility:'||p_level,'record-eligibility:'||p_level,3,clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION zc_private.schedule_record_eligibility(integer) FROM PUBLIC;

-- Transition tables coalesce an entire bulk upsert by level. Queue writes roll
-- back with validation writes, and running queue selections are never changed.
CREATE FUNCTION zc_private.tg_record_validation_eligibility() RETURNS trigger
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
REVOKE ALL ON FUNCTION zc_private.tg_record_validation_eligibility() FROM PUBLIC;
CREATE TRIGGER validation_eligibility_insert AFTER INSERT ON zc_private.record_validation
 REFERENCING NEW TABLE AS new_validations FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_record_validation_eligibility();
CREATE TRIGGER validation_eligibility_update AFTER UPDATE ON zc_private.record_validation
 REFERENCING OLD TABLE AS old_validations NEW TABLE AS new_validations
 FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_record_validation_eligibility();
CREATE TRIGGER validation_eligibility_delete AFTER DELETE ON zc_private.record_validation
 REFERENCING OLD TABLE AS old_validations FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_record_validation_eligibility();

-- has_records remains sticky: hiding a failed run must not change Workshop
-- visibility. Only the private discovery count now counts eligible records.
UPDATE public.level l SET record_count=greatest(0,l.record_count-f.failures)
FROM (SELECT r.id_level,count(*) AS failures FROM public.record r
 JOIN zc_private.record_validation v ON v.id_record=r.id WHERE v.status='fail' GROUP BY r.id_level) f
WHERE l.id=f.id_level;
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
ALTER TABLE zc_private.record_history_index ENABLE ROW LEVEL SECURITY; CREATE POLICY record_eligibility ON zc_private.record_history_index FOR SELECT TO zeepcentraal_graphql USING(zc_private.record_is_eligible(id));
DROP TRIGGER "trg__discord_personal_best_event" ON public.personal_best_global;
CREATE TRIGGER "trg__discord_personal_best_event"
AFTER INSERT OR UPDATE OF id_record ON public.personal_best_global
FOR EACH ROW WHEN (coalesce(current_setting('zc.validation_correction',true),'off')<>'on') EXECUTE FUNCTION zc_private.tg_discord_personal_best_event();
DROP TRIGGER "trg__discord_world_record_event" ON public.world_record_global;
CREATE TRIGGER "trg__discord_world_record_event"
AFTER INSERT OR UPDATE OF id_record ON public.world_record_global
FOR EACH ROW WHEN (coalesce(current_setting('zc.validation_correction',true),'off')<>'on') EXECUTE FUNCTION zc_private.tg_discord_world_record_event();
CREATE POLICY record_eligibility ON public.discord_activity_event AS RESTRICTIVE FOR SELECT TO zeepcentraal_graphql USING(zc_private.record_is_eligible(id_record) AND zc_private.record_is_eligible(id_previous_record));

-- Finalized results are historical snapshots. Keep them readable while their
-- failed record relationship is filtered independently by record RLS.
ALTER POLICY graphql_select_visible_track_tournament_result ON public.track_tournament_result
 USING(EXISTS(SELECT 1 FROM public.track_tournament t JOIN public.level l ON l.id=t.id_level
 WHERE t.id=id_tournament AND l.publicly_visible
 AND (t.finalized_at IS NOT NULL OR zc_private.record_is_eligible(id_record))));

-- Give the restricted SQL reader only eligibility columns, never JSONB evidence.
GRANT SELECT(id_record,status) ON zc_private.record_validation TO zeepcentraal_graphql;
ALTER POLICY record_eligibility ON public.record USING(NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=record.id AND v.status='fail'));
ALTER POLICY record_eligibility ON public.record_media USING(NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=record_media.id_record AND v.status='fail'));
ALTER POLICY record_eligibility ON public.record_statistic USING(NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=record_statistic.id_record AND v.status='fail'));
ALTER POLICY record_eligibility ON public.personal_best_global USING(NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=personal_best_global.id_record AND v.status='fail'));
ALTER POLICY record_eligibility ON public.world_record_global USING(NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=world_record_global.id_record AND v.status='fail'));
ALTER POLICY record_eligibility ON public.user_point_contribution USING(NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=user_point_contribution.id_record AND v.status='fail'));
ALTER POLICY record_eligibility ON zc_private.record_history_index USING(NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=record_history_index.id AND v.status='fail'));
