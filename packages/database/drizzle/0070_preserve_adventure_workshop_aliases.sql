UPDATE public.level_item AS adventure_level_item
SET
		deleted = false,
		date_updated = now()
FROM public.level AS adventure_level
WHERE adventure_level.id = adventure_level_item.id_level
	AND adventure_level.adventure = true
	AND adventure_level_item.deleted = true;
