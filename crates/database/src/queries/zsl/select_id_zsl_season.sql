SELECT id,id_points_structure FROM public.zsl_season WHERE name=$1 LIMIT 1 FOR UPDATE
