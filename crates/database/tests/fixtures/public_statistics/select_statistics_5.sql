SELECT (to_jsonb(s)-'singleton'-'semantics_version')=to_jsonb(public.global_metrics()) FROM public.statistics s
