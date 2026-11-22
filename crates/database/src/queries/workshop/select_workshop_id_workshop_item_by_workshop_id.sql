SELECT workshop_id FROM public.workshop_item WHERE workshop_id=ANY($1) ORDER BY workshop_id FOR UPDATE
