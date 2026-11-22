SELECT (to_jsonb(s)-'players_all'-'semantics_version')::text FROM public.statistics s
