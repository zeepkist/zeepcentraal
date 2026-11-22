SELECT id_level,value FROM public.vote WHERE id_level=ANY($1) AND coalesce(date_updated,date_created)<=clock_timestamp()-interval '7 days'
