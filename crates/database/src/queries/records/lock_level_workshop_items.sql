SELECT wi.workshop_id FROM public.workshop_item wi WHERE EXISTS(SELECT 1 FROM public.level_item li WHERE li.id_level=$1 AND li.workshop_id=wi.workshop_id) ORDER BY wi.workshop_id FOR UPDATE
