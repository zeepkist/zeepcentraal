
        INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE
          SELECT id,100000+id,false FROM generate_series(1,205) id;
        INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE VALUES(1,'score-test',repeat('c',32),true);
        INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE
          SELECT id,id,1,id::real,'test','test',CASE WHEN id<=201 THEN now() ELSE '2000-01-01'::timestamptz END FROM generate_series(1,205) id;
        INSERT INTO public.personal_best_global(id_user,id_level,id_record) SELECT id,1,id FROM generate_series(1,205) id;
        INSERT INTO public.level_points(id_level,points) VALUES(1,1000);
        INSERT INTO public.user_point_contribution(id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points,date_calculated)
          SELECT id,1,id,1,id,1000,(1000-id/2)::real,0,now() FROM generate_series(1,205) id;
        INSERT INTO public.user_points(id_user,points,total_points,rank) SELECT id,-10,-10,-1 FROM generate_series(1,205) id;
        TRUNCATE zc_jobs.job,pgmq.q_zeepcentraal_fast,pgmq.q_zeepcentraal_bulk;
