SELECT array_agg(r.id ORDER BY r.id) FROM public.record r WHERE r.record_eligible
