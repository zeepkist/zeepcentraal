
      TRUNCATE public."user",public.level,public.discord_activity_event,zc_jobs.job RESTART IDENTITY CASCADE;
      INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE VALUES(1,42,false),(2,43,false),(3,44,true),(4,45,false);
      INSERT INTO public.level(id,hash,xx_hash,publicly_visible,adventure) OVERRIDING SYSTEM VALUE VALUES(1,'fixture',repeat('a',32),true,true),(2,'empty',repeat('b',32),true,true);
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE VALUES
       (1,1,1,10,'test','test','2026-01-01'),(2,1,1,12,'test','test','2026-01-02'),
       (3,2,1,11,'test','test','2026-01-03'),(4,2,1,11,'test','test','2026-01-04'),
       (5,3,1,1,'test','test','2026-01-05'),(6,4,1,15,'test','test','2026-01-06'),
       (7,1,2,5,'test','test','2026-01-07');
      INSERT INTO public.record_media(id_record,ghost_url) VALUES(1,'fixture-ghost'),(2,'fixture-ghost-2');
      INSERT INTO public.record_statistic(id_record,ghost_version) VALUES(1,8),(2,8);
      INSERT INTO public.personal_best_global(id_user,id_level,id_record) VALUES(1,1,1),(2,1,3),(1,2,7);
      INSERT INTO public.world_record_global(id_user,id_level,id_record) VALUES(1,1,1),(1,2,7);
      INSERT INTO public.track_tournament(id,type,slug,id_level,start_at,end_at,finalized_at) OVERRIDING SYSTEM VALUE VALUES
       (1,0,'active',1,'2026-01-01','2026-01-04',NULL),
       (2,1,'finalized',1,'2026-01-01','2026-01-04','2026-01-05');
      INSERT INTO public.track_tournament_result(id_tournament,id_user,id_record,time,rank,points)
       VALUES(1,1,1,10,1,1000),(2,1,1,10,1,1000);
      GRANT USAGE ON SCHEMA public,zc_private TO zeepcentraal_graphql;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO zeepcentraal_graphql;
      GRANT SELECT ON zc_private.record_history_index TO zeepcentraal_graphql;
