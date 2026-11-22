INSERT INTO public.user_points(id_user,points,total_points,rank,world_records) VALUES($1,0,0,-1,0) ON CONFLICT(id_user) DO NOTHING
