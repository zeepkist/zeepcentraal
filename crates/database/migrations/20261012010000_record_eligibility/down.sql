REVOKE SELECT(id_record,status) ON zc_private.record_validation FROM zeepcentraal_graphql;
DROP TRIGGER validation_eligibility_insert ON zc_private.record_validation;
DROP TRIGGER validation_eligibility_update ON zc_private.record_validation;
DROP TRIGGER validation_eligibility_delete ON zc_private.record_validation;
DROP FUNCTION zc_private.tg_record_validation_eligibility();
DROP FUNCTION zc_private.schedule_record_eligibility(integer);
DROP POLICY record_eligibility ON public.record;
ALTER TABLE public.record DISABLE ROW LEVEL SECURITY;
DROP POLICY record_eligibility ON public.record_media;
ALTER TABLE public.record_media DISABLE ROW LEVEL SECURITY;
DROP POLICY record_eligibility ON public.record_statistic;
ALTER TABLE public.record_statistic DISABLE ROW LEVEL SECURITY;
DROP POLICY record_eligibility ON public.personal_best_global;
ALTER TABLE public.personal_best_global DISABLE ROW LEVEL SECURITY;
DROP POLICY record_eligibility ON public.world_record_global;
ALTER TABLE public.world_record_global DISABLE ROW LEVEL SECURITY;
DROP POLICY record_eligibility ON public.user_point_contribution;
ALTER TABLE public.user_point_contribution DISABLE ROW LEVEL SECURITY;
DROP POLICY record_eligibility ON zc_private.record_history_index;
ALTER TABLE zc_private.record_history_index DISABLE ROW LEVEL SECURITY;
DROP FUNCTION zc_private.is_visible_record(integer);
UPDATE public.level l SET record_count=(SELECT count(*) FROM public.record r WHERE r.id_level=l.id);
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
				record_count = record_count + 1,
				has_records = true
			WHERE id = affected_level_id;
		ELSE
			UPDATE public.level
			SET record_count = GREATEST(record_count - 1, 0)
			WHERE id = affected_level_id;
		END IF;
	END LOOP;

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$;
DROP POLICY record_eligibility ON public.discord_activity_event;


DROP TRIGGER "trg__discord_personal_best_event" ON public.personal_best_global;
CREATE TRIGGER "trg__discord_personal_best_event"
AFTER INSERT OR UPDATE OF id_record ON public.personal_best_global
FOR EACH ROW EXECUTE FUNCTION zc_private.tg_discord_personal_best_event();
DROP TRIGGER "trg__discord_world_record_event" ON public.world_record_global;
CREATE TRIGGER "trg__discord_world_record_event"
AFTER INSERT OR UPDATE OF id_record ON public.world_record_global
FOR EACH ROW EXECUTE FUNCTION zc_private.tg_discord_world_record_event();

DROP POLICY graphql_select_visible_track_tournament_result ON public.track_tournament_result;
CREATE POLICY "graphql_select_visible_track_tournament_result" ON "track_tournament_result" AS PERMISSIVE FOR SELECT TO "zeepcentraal_graphql" USING (
				EXISTS (
					SELECT 1
					FROM public.track_tournament AS visible_tournament
					INNER JOIN public.level AS graphql_visible_level
						ON graphql_visible_level.id = visible_tournament.id_level
						AND graphql_visible_level.publicly_visible = true
					WHERE visible_tournament.id = "track_tournament_result"."id_tournament"
				)
				AND EXISTS (
					SELECT 1
					FROM public.record AS graphql_visible_record
					INNER JOIN public.level AS graphql_record_level
						ON graphql_record_level.id = graphql_visible_record.id_level
						AND graphql_record_level.publicly_visible = true
					WHERE graphql_visible_record.id = "track_tournament_result"."id_record"
				)
			);
DROP FUNCTION zc_private.record_is_eligible(integer);
