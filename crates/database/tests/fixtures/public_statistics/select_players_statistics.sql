SELECT players,semantics_version,
             (to_jsonb(s)-'singleton'-'semantics_version')=to_jsonb(zc_private.compute_global_metrics(s.as_of)),
             to_jsonb(s) ? 'players_all',
             to_jsonb(zc_private.compute_global_metrics(s.as_of)) ? 'players_all',
             'public.statistics'::regclass::oid::bigint,
             'public.global_metric_summary'::regtype::oid::bigint
             FROM public.statistics s
