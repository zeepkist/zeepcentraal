SELECT count(*)::bigint AS count FROM public.track_tournament_result WHERE id_tournament=$1
