SELECT 'public.statistics'::regclass::oid::bigint,
             to_regclass('zc_private.global_metrics_snapshot') IS NULL,
             (SELECT count(*) FROM public.statistics),
             (to_jsonb(s)-'singleton'-'semantics_version')=
                 to_jsonb(zc_private.compute_global_metrics(s.as_of))
             FROM public.statistics s
