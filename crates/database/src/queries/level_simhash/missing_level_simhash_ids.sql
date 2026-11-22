SELECT id FROM public.level WHERE simhash IS NULL AND id>$1 ORDER BY id LIMIT $2
