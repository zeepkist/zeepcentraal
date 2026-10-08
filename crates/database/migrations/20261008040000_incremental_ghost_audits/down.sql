DROP TRIGGER level_metadata_validation_inputs ON public.level_metadata;
DROP TRIGGER level_item_validation_inputs ON public.level_item;
DROP FUNCTION zc_private.touch_validation_inputs();
ALTER TABLE public.level DROP COLUMN validation_inputs_updated_at;
ALTER TABLE zc_private.record_validation DROP COLUMN checked_at;
DROP INDEX public."IX_records_level_id";
DROP INDEX IF EXISTS zc_jobs.ghost_validation_pending_tasks;
