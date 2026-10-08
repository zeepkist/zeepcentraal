-- One timestamp per level tracks metadata/membership changes, including removed rows.
ALTER TABLE public.level ADD COLUMN validation_inputs_updated_at timestamptz NOT NULL DEFAULT 'epoch';
COMMENT ON COLUMN public.level.validation_inputs_updated_at IS '@omit all';
UPDATE public.level l SET validation_inputs_updated_at=inputs.changed_at
FROM (SELECT id_level,max(changed_at) AS changed_at FROM (
 SELECT id_level,coalesce(date_updated,date_created) AS changed_at FROM public.level_metadata
 UNION ALL SELECT id_level,coalesce(date_updated,date_created) FROM public.level_item
) source GROUP BY id_level) inputs WHERE inputs.id_level=l.id;
CREATE FUNCTION zc_private.touch_validation_inputs() RETURNS trigger LANGUAGE plpgsql AS $$
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
CREATE TRIGGER level_metadata_validation_inputs AFTER INSERT OR UPDATE OR DELETE ON public.level_metadata FOR EACH ROW EXECUTE FUNCTION zc_private.touch_validation_inputs();
CREATE TRIGGER level_item_validation_inputs AFTER INSERT OR UPDATE OR DELETE ON public.level_item FOR EACH ROW EXECUTE FUNCTION zc_private.touch_validation_inputs();
ALTER TABLE zc_private.record_validation ADD COLUMN checked_at timestamptz;
CREATE INDEX "IX_records_level_id" ON public.record(id_level,id);
COMMENT ON COLUMN zc_private.record_validation.checked_at IS 'Assigned level input timestamp examined by validator; NULL requires one checkpointed audit';
DO $$ BEGIN IF to_regclass('zc_jobs.job') IS NOT NULL THEN
 UPDATE zc_jobs.job SET lock_group='ghost-audit' WHERE task='auditRecordGhosts';
 CREATE INDEX IF NOT EXISTS ghost_validation_pending_tasks ON zc_jobs.job(task) WHERE task='validateRecordGhost';
END IF; END $$;
