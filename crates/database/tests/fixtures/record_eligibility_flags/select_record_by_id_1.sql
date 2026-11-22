SELECT (to_jsonb(r)-'record_eligible')::text FROM public.record r WHERE id=1
