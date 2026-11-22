SELECT DISTINCT level.id AS id_level FROM public.level_item item JOIN public.level level ON level.id=item.id_level WHERE item.workshop_id=ANY($1) AND NOT level.adventure ORDER BY level.id
