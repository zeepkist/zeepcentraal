-- Dedicated zc_optimization_test database only. Schema includes pending migrations.
SELECT zc_private.rollback_history_fact();
TRUNCATE public."user",public.level,public.zsl_points_structure,zc_private.global_metrics_snapshot,zc_private.history_fact_dirty RESTART IDENTITY CASCADE;
UPDATE zc_private.history_fact_rollout SET backfill_after=0,backfill_done=false,verify_after=0,verified=false;
INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE VALUES
 (1,101,false),(2,102,true),(3,103,false),(4,104,false);
INSERT INTO public.level(id,hash,xx_hash,date_created) OVERRIDING SYSTEM VALUE VALUES
 (1,'metric-1',md5('metric-1'),'2026-10-18 08:00Z'),
 (2,'metric-2',md5('metric-2'),'2026-10-10 08:00Z'),
 (3,'metric-3',md5('metric-3'),'2026-09-10 08:00Z');
INSERT INTO public.workshop_item(workshop_id,author_id,name,image_url,visibility) VALUES
 (901,101,'metrics','',0),(902,103,'metrics','',0),(903,101,'metrics','',0);
INSERT INTO public.level_item(id_level,workshop_id,author_id,name,image_url,file_author,file_uid,
 validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,deleted,created_at,updated_at)
SELECT id_level,workshop_id,author_id,'metrics','','metrics','metrics',0,0,0,0,deleted,created_at,created_at
FROM (VALUES (1,901::bigint,101::bigint,false,'2026-10-18 08:00Z'::timestamptz),
 (1,902,103,false,'2026-10-18 07:00Z'::timestamptz),(2,903,101,true,'2026-10-10 08:00Z'::timestamptz))
 fixture(id_level,workshop_id,author_id,deleted,created_at);
INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE VALUES
 (1,1,1,10,'test','test','2026-10-18 10:00Z'),
 (2,1,2,11,'test','test','2026-10-10 10:00Z'),
 (3,2,1,12,'test','test','2026-10-18 11:00Z'),
 (4,3,3,13,'test','test','2026-09-20 10:00Z'),
 (5,1,1,14,'test','test','2026-10-18 09:00Z');
INSERT INTO public.personal_best_global(id_user,id_level,id_record) VALUES(1,1,1),(1,2,2),(2,1,3),(3,3,4);
INSERT INTO public.world_record_global(id_user,id_level,id_record) VALUES(1,1,1),(1,2,2),(3,3,4);
INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version)
 VALUES(5,1,1,'fail','{}','test'),(1,1,1,'pending','{}','test'),
 (2,1,2,'uncertain','{}','test'),(3,2,1,'pass','{}','test');
INSERT INTO public.user_point_contribution(id_user,id_level,id_record,contribution_rank,level_position,level_points,level_decayed_points,player_decayed_points,date_calculated)
 VALUES(1,1,1,1,1,1000,100,100,'2026-10-18 11:00Z'),(1,2,2,2,1,1000,100,100,'2026-10-18 11:00Z');
INSERT INTO public.user_points(id_user,rank) VALUES(1,3),(2,2),(3,-1);
INSERT INTO public.vote(id_user,id_level,value,date_created) VALUES
 (1,1,1,'2026-10-18 10:00Z'),(3,2,1,'2026-10-10 10:00Z');
UPDATE public.level SET publicly_visible=(id IN (1,3));
INSERT INTO public.zsl_points_structure(id,name,points,minimum_points,best_of) OVERRIDING SYSTEM VALUE
 VALUES(1,'metrics',ARRAY[1],0,1);
INSERT INTO public.zsl_season(id,id_points_structure,name,start_date,end_date) OVERRIDING SYSTEM VALUE
 VALUES(1,1,'metrics','2026-01-01Z','2027-01-01Z');
INSERT INTO public.zsl_round(id,id_season,name,round,workshop_id,event_date) OVERRIDING SYSTEM VALUE
 VALUES(1,1,'metrics',1,1,'2026-10-18 11:00Z');
INSERT INTO public.zsl_level(id,id_round,id_level) OVERRIDING SYSTEM VALUE VALUES(1,1,1);
INSERT INTO public.zsl_level_result(id_level,id_user,position,points,time) VALUES(1,4,1,1,10);
