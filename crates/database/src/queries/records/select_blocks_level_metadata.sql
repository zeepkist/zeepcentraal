SELECT blocks,format,type_ground,type_skybox FROM public.level_metadata WHERE id_level=$1 ORDER BY id LIMIT 1
