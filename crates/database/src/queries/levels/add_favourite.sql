INSERT INTO public.favourite(id_user,id_level) VALUES ($1,$2) ON CONFLICT (id_user,id_level) DO NOTHING
