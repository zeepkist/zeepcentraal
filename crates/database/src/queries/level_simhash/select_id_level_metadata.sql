SELECT id FROM public.level_metadata WHERE id=$1 AND id_level=$2 AND xmin::text=$3 AND id=(SELECT id FROM public.level_metadata WHERE id_level=$2 ORDER BY id LIMIT 1) FOR SHARE
