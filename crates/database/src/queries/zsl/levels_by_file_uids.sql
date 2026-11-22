SELECT level.id,level_item.file_uid::text FROM public.level INNER JOIN public.level_item ON level.id=level_item.id_level WHERE level_item.file_uid=ANY($1)
