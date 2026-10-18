DROP TRIGGER guard_record_validation ON zc_private.record_validation;
DROP FUNCTION zc_private.guard_record_validation();
CREATE OR REPLACE FUNCTION zc_private.touch_validation_inputs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN RETURN NEW; END IF;
 IF TG_OP IN ('UPDATE','DELETE') THEN
  UPDATE public.level SET validation_inputs_updated_at=greatest(clock_timestamp(),validation_inputs_updated_at+interval '1 microsecond') WHERE id=OLD.id_level;
 END IF;
 IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND NEW.id_level IS DISTINCT FROM OLD.id_level) THEN
  UPDATE public.level SET validation_inputs_updated_at=greatest(clock_timestamp(),validation_inputs_updated_at+interval '1 microsecond') WHERE id=NEW.id_level;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER level_item_validation_inputs AFTER INSERT OR UPDATE OR DELETE ON public.level_item
FOR EACH ROW EXECUTE FUNCTION zc_private.touch_validation_inputs();
ALTER TABLE zc_private.record_validation DROP COLUMN checked_metadata_at;
ALTER TABLE public.level DROP COLUMN validation_metadata_updated_at;

CREATE OR REPLACE FUNCTION zc_private.tg_user_record_count_refresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target integer;
BEGIN
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
