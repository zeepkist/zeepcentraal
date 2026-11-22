INSERT INTO public.record(id_user,id_level,time,game_version,mod_version,splits,speeds) SELECT $1,$2,2,'test','test',NULL,NULL FROM generate_series(1,205)
