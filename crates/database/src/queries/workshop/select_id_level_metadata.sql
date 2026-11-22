SELECT id FROM public.level_metadata WHERE id_level=$1 ORDER BY id LIMIT 1 FOR UPDATE
