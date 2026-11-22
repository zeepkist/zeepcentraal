SELECT id,simhash FROM public.level WHERE xx_hash=$1 LIMIT 1 FOR UPDATE
