INSERT INTO public.vote(id_user,id_level,value) VALUES ($1,$2,$3) ON CONFLICT (id_user,id_level) DO UPDATE SET value=excluded.value,date_updated=clock_timestamp()
