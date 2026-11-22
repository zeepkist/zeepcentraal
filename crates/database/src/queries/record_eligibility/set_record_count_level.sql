UPDATE public.level SET record_count=(SELECT count(*) FROM public.record r WHERE r.id_level=$1 AND r.record_eligible) WHERE id=$1
