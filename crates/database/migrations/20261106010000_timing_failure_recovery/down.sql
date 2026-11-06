CREATE OR REPLACE FUNCTION zc_private.guard_record_validation() RETURNS trigger LANGUAGE plpgsql AS $$
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

DROP FUNCTION zc_private.recover_timing_failure(integer,jsonb,text,jsonb,text,text);
DROP FUNCTION zc_private.is_timing_failure(text,text,jsonb);
