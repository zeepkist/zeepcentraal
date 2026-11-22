INSERT INTO public.record(id,id_user,id_level,time) SELECT id,1,1+(id%2),10 FROM generate_series(1,3000001) id
