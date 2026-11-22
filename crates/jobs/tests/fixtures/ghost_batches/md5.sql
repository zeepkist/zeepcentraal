SELECT md5(string_agg(to_jsonb(r)::text,',' ORDER BY id)) AS value FROM public.record r
