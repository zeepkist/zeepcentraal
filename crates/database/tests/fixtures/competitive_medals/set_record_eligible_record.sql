UPDATE public.record SET record_eligible=false WHERE id=1; UPDATE public.personal_best_global SET record_eligible=false WHERE id=1; SELECT zc_private.refresh_level_medals(1)
