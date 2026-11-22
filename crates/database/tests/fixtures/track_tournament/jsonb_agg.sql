SELECT jsonb_agg(to_jsonb(r) ORDER BY id_user) AS value FROM public.track_tournament_result r
