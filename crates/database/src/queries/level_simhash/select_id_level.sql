SELECT id FROM public.level WHERE id=$1 AND simhash IS NULL FOR UPDATE
