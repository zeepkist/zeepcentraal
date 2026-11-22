UPDATE public.record SET record_eligible=true WHERE id=110; UPDATE public.personal_best_global SET record_eligible=true WHERE id=110; SELECT zc_private.refresh_level_medals(2)
