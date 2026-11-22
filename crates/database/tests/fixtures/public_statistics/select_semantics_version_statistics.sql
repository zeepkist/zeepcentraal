SELECT semantics_version=2 AND NOT(to_jsonb(s)?'records_yesterday') FROM public.statistics s
