
      TRUNCATE public."user",public.level,public.record,public.personal_best_global,
        public.world_record_global,public.user_point_contribution,public.player_skill_aggregate,
        public.user_points,public.level_points,public.record_media,public.level_item,
        public.level_metadata,zc_private.record_validation,zc_jobs.job RESTART IDENTITY CASCADE;
      TRUNCATE pgmq.q_zeepcentraal_bulk,pgmq.q_zeepcentraal_fast;
      INSERT INTO public."user"(id,steam_id) OVERRIDING SYSTEM VALUE VALUES(1,42);
      INSERT INTO public.level(id,hash,xx_hash) OVERRIDING SYSTEM VALUE VALUES(1,'a',repeat('a',32)),(2,'b',repeat('b',32));
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
        SELECT id,1,1,10,'test','test' FROM generate_series(1,1105) id;
      INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version,checked_at)
        SELECT id,1,1,CASE WHEN id<=1100 THEN 'fail' WHEN id=1101 THEN 'uncertain' WHEN id=1102 THEN 'pass' ELSE 'pending' END,
          '{"reasons":["ghost_storage_unavailable"]}','old','epoch' FROM generate_series(1,1104) id;
      INSERT INTO public.personal_best_global(id_user,id_level,id_record) VALUES(1,1,1101);
      INSERT INTO public.world_record_global(id_user,id_level,id_record) VALUES(1,1,1101);
