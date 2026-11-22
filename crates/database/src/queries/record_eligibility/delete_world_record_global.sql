DELETE FROM public.world_record_global WHERE id_level=$1 AND NOT EXISTS(SELECT 1 FROM eligible_record_winners)
