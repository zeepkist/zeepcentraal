-- Synthetic data only. Caller guards the isolated database name.
TRUNCATE public."user",public.level,public.discord_activity_event,zc_jobs.job RESTART IDENTITY CASCADE;
INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE
 SELECT id,100000+id,false FROM generate_series(1,4) id;
INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE
 SELECT id,'flag-fixture-'||id,md5(id::text),true FROM generate_series(1,4) id;
INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE
 SELECT id,id,id,20,'fixture','fixture','2026-10-01' FROM generate_series(1,4) id;
INSERT INTO public.record_media(id_record,ghost_url) SELECT id,'fixture-ghost' FROM public.record;
INSERT INTO public.record_statistic(id_record,ghost_version,distance) SELECT id,6,100 FROM public.record;
INSERT INTO public.personal_best_global(id_user,id_level,id_record) SELECT id_user,id_level,id FROM public.record;
INSERT INTO public.world_record_global(id_user,id_level,id_record) SELECT id_user,id_level,id FROM public.record;
INSERT INTO public.user_point_contribution(id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points)
 SELECT id_user,id_level,id,1,1,100,100,100 FROM public.record;
INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version)
 VALUES(1,1,1,'fail','{}','fixture'),(3,3,3,'uncertain','{}','fixture');
INSERT INTO public.track_tournament(id,type,slug,id_level,start_at,end_at,finalized_at) OVERRIDING SYSTEM VALUE
 VALUES(1,0,'flag-active',1,'2026-10-01','2026-10-31',NULL),
       (2,1,'flag-finalized',1,'2026-10-01','2026-10-02','2026-10-03');
INSERT INTO public.track_tournament_result(id_tournament,id_user,id_record,time,rank,points)
 VALUES(1,1,1,20,1,100),(2,1,1,20,1,100);
GRANT USAGE ON SCHEMA public,zc_private TO zeepcentraal_graphql;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO zeepcentraal_graphql;
GRANT SELECT ON zc_private.record_history_index TO zeepcentraal_graphql;
