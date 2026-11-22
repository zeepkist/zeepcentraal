
        TRUNCATE public."user",public.level,public.record,
          public.personal_best_global,public.world_record_global,
          public.user_point_contribution,public.player_skill_aggregate,
          public.user_points,public.level_points,public.record_media,
          public.record_statistic,public.track_tournament,
          public.track_tournament_result,zc_private.record_validation
          RESTART IDENTITY CASCADE;
        INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE
          SELECT id,100000+id,false FROM generate_series(1,20) id;
        INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE
          SELECT id,'fanout-'||id,md5(id::text),true FROM generate_series(1,3) id;
        INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
          SELECT id,id,1,id::real,'test','test' FROM generate_series(1,20) id;
        INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
          VALUES(21,1,2,7,'test','test'),(22,2,3,7,'test','test');
        INSERT INTO public.personal_best_global(id_user,id_level,id_record)
          SELECT id,1,id FROM generate_series(1,20) id;
        INSERT INTO public.personal_best_global(id_user,id_level,id_record) VALUES(1,2,21),(2,3,22);
