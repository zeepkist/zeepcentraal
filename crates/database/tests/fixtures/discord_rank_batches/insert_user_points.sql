INSERT INTO public.user_points(id_user,points,rank) SELECT id,100,id+1 FROM generate_series($1::integer,$2::integer) id
