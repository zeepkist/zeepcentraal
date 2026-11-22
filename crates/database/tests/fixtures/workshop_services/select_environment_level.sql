SELECT metadata.environment::text,metadata.blocks::text,level.hash,level.xx_hash FROM public.level level JOIN public.level_metadata metadata ON metadata.id_level=level.id WHERE level.id=$1
