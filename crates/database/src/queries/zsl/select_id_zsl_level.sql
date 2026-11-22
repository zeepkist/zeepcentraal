SELECT id FROM public.zsl_level WHERE id_round=$1 AND id_level=$2 LIMIT 1 FOR UPDATE
