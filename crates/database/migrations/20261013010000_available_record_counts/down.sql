DROP TRIGGER level_count_delete ON public.level_item;
DROP TRIGGER level_count_update ON public.level_item;
DROP TRIGGER level_count_insert ON public.level_item;
DROP FUNCTION zc_private.tg_level_record_count_refresh();
DROP TRIGGER wr_count_delete ON public.world_record_global;
DROP TRIGGER wr_count_update ON public.world_record_global;
DROP TRIGGER wr_count_insert ON public.world_record_global;
DROP TRIGGER pb_count_delete ON public.personal_best_global;
DROP TRIGGER pb_count_update ON public.personal_best_global;
DROP TRIGGER pb_count_insert ON public.personal_best_global;
DROP FUNCTION zc_private.tg_user_record_count_refresh();
DROP FUNCTION zc_private.user_record_counts(integer[]);
ALTER TABLE public.user_points DROP COLUMN personal_bests;
UPDATE public.user_points points SET world_records=(SELECT count(*)::integer
 FROM public.world_record_global wr WHERE wr.id_user=points.id_user
 AND zc_private.record_is_eligible(wr.id_record));
