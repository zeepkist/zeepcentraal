DELETE FROM public.lobby WHERE master_id=ANY($1)
