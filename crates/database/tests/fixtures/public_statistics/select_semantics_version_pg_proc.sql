SELECT semantics_version, 'public.statistics'::regclass::oid::bigint,
      (to_jsonb(s)-'singleton'-'semantics_version')=to_jsonb(zc_private.compute_global_metrics(s.as_of)),
      (SELECT provolatile='s' FROM pg_proc WHERE oid='public.global_metrics()'::regprocedure)
      FROM public.statistics s
