SELECT s.id FROM public.zsl_season s JOIN public.zsl_round r ON r.id_season=s.id WHERE r.id=$1 FOR UPDATE OF s
