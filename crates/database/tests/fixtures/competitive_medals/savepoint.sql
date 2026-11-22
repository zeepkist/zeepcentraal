RESET ROLE; SAVEPOINT zsl_medal_checks; UPDATE public.zsl_level_result SET id_record=1 WHERE id_user=1; UPDATE public.record SET record_eligible=false WHERE id=1
