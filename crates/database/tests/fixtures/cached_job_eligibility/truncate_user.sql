
      TRUNCATE public."user",public.level,public.record,public.personal_best_global,
        public.world_record_global,public.user_point_contribution,public.player_skill_aggregate,
        public.user_points,public.level_points,public.record_media,public.record_statistic,
        public.track_tournament,public.track_tournament_result,public.level_item,
        zc_private.record_validation,zc_jobs.job RESTART IDENTITY CASCADE;
      INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE
        SELECT id,100000+id,id=60 FROM generate_series(1,61) id;
      INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE
        SELECT id,'cached-'||id,md5(id::text),false FROM generate_series(1,3) id;
      INSERT INTO public.workshop_item(workshop_id,author_id,name,image_url,visibility)
        VALUES(987651,100001,'cached scoring fixture','',0) ON CONFLICT(workshop_id) DO NOTHING;
      INSERT INTO public.level_item(id_level,workshop_id,author_id,name,image_url,file_author,file_uid,
        validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,deleted,created_at,updated_at)
        VALUES(1,987651,100001,'available','','fixture','available',0,0,0,0,false,now(),now()),
              (2,987651,100001,'unavailable','','fixture','unavailable',0,0,0,0,true,now(),now());
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
        SELECT id,id,1,((id+1)/2)::real,'test','test' FROM generate_series(1,60) id;
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
        VALUES(61,1,2,10,'test','test'),(62,61,3,10,'test','test');
      INSERT INTO public.personal_best_global(id_user,id_level,id_record)
        SELECT id_user,id_level,id FROM public.record;
      INSERT INTO public.world_record_global(id_user,id_level,id_record) VALUES(1,1,1),(1,2,61),(61,3,62);
      INSERT INTO public.level_points(id_level,points) SELECT id,1000 FROM generate_series(1,3) id;
      INSERT INTO public.user_point_contribution(id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points,date_calculated)
        SELECT id_user,id_level,id,1,999,1000,1,1,now() FROM public.record;
      INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version)
        VALUES(1,1,1,'fail','{}','test'),(2,2,1,'pass','{}','test'),
          (3,3,1,'pending','{}','test'),(4,4,1,'uncertain','{}','test'),(62,61,3,'fail','{}','test');
