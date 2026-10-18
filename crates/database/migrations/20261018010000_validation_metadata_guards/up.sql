-- Workshop membership controls availability, never validation eligibility.
DROP TRIGGER level_item_validation_inputs ON public.level_item;
ALTER TABLE public.level ADD COLUMN validation_metadata_updated_at timestamptz NOT NULL DEFAULT 'epoch';
ALTER TABLE zc_private.record_validation ADD COLUMN checked_metadata_at timestamptz NOT NULL DEFAULT 'epoch';
COMMENT ON COLUMN public.level.validation_metadata_updated_at IS '@omit all';
COMMENT ON COLUMN zc_private.record_validation.checked_metadata_at IS '@omit all';

CREATE OR REPLACE FUNCTION zc_private.touch_validation_inputs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND
    (to_jsonb(OLD)-ARRAY['id','date_created','date_updated']) IS NOT DISTINCT FROM
    (to_jsonb(NEW)-ARRAY['id','date_created','date_updated']) THEN RETURN NEW; END IF;
 IF TG_OP IN ('UPDATE','DELETE') THEN
  UPDATE public.level SET
   validation_inputs_updated_at=greatest(clock_timestamp(),validation_inputs_updated_at+interval '1 microsecond'),
   validation_metadata_updated_at=greatest(clock_timestamp(),validation_metadata_updated_at+interval '1 microsecond')
  WHERE id=OLD.id_level;
 END IF;
 IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND NEW.id_level IS DISTINCT FROM OLD.id_level) THEN
  UPDATE public.level SET
   validation_inputs_updated_at=greatest(clock_timestamp(),validation_inputs_updated_at+interval '1 microsecond'),
   validation_metadata_updated_at=greatest(clock_timestamp(),validation_metadata_updated_at+interval '1 microsecond')
  WHERE id=NEW.id_level;
 END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION zc_private.guard_record_validation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_metadata timestamptz;
BEGIN
 -- Retained failed evidence cannot be replaced, reassigned, or removed.
 IF TG_OP IN ('UPDATE','DELETE') AND OLD.status='fail'
    AND EXISTS(SELECT 1 FROM public.record WHERE id=OLD.id_record) THEN RETURN NULL; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 SELECT l.validation_metadata_updated_at INTO current_metadata
 FROM public.level l JOIN public.record r ON r.id_level=l.id
 WHERE l.id=NEW.id_level AND r.id=NEW.id_record AND r.id_user=NEW.id_user FOR NO KEY UPDATE OF l;
 -- Evidence describes the snapshot captured before validation, not a later snapshot.
 IF NEW.checked_metadata_at IS DISTINCT FROM current_metadata THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' AND OLD.status='uncertain'
    AND (NEW.id_record IS DISTINCT FROM OLD.id_record OR NEW.id_level IS DISTINCT FROM OLD.id_level
         OR NEW.checked_metadata_at<=OLD.checked_metadata_at) THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_record_validation BEFORE INSERT OR UPDATE OR DELETE ON zc_private.record_validation
FOR EACH ROW EXECUTE FUNCTION zc_private.guard_record_validation();

-- Reconciliation publishes durable player pages instead of per-row trigger jobs.
CREATE OR REPLACE FUNCTION zc_private.tg_user_record_count_refresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target integer;
BEGIN
 IF coalesce(current_setting('zc.validation_correction',true),'off')='on' THEN RETURN NULL; END IF;
 IF TG_OP='INSERT' THEN
  FOR target IN SELECT DISTINCT id_user FROM new_counts ORDER BY id_user LOOP
   PERFORM zc_jobs.enqueue('bulk','updatePlayerScore',jsonb_build_object('idUser',target),
    'update-player-score:'||target,'global-scores',3,clock_timestamp());
  END LOOP;
 ELSIF TG_OP='DELETE' THEN
  FOR target IN SELECT DISTINCT previous.id_user FROM old_counts previous
   JOIN public."user" account ON account.id=previous.id_user ORDER BY previous.id_user LOOP
   PERFORM zc_jobs.enqueue('bulk','updatePlayerScore',jsonb_build_object('idUser',target),
    'update-player-score:'||target,'global-scores',3,clock_timestamp());
  END LOOP;
 ELSE
  FOR target IN
   SELECT id_user FROM (
    SELECT id_user,id_level,id_record FROM old_counts
    EXCEPT SELECT id_user,id_level,id_record FROM new_counts
   ) removed
   UNION SELECT id_user FROM (
    SELECT id_user,id_level,id_record FROM new_counts
    EXCEPT SELECT id_user,id_level,id_record FROM old_counts
   ) added ORDER BY id_user
  LOOP
   PERFORM zc_jobs.enqueue('bulk','updatePlayerScore',jsonb_build_object('idUser',target),
    'update-player-score:'||target,'global-scores',3,clock_timestamp());
  END LOOP;
 END IF;
 RETURN NULL;
END $$;
