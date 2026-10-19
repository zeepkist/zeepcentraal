-- Synthetic plan fixture only. No source data or production payloads.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'zc_optimization_test' THEN
  RAISE EXCEPTION 'Dedicated zc_optimization_test database required';
 END IF;
END $$;
SELECT zc_private.rollback_history_fact();
-- Bulk fixture loading skips triggers. All measured writes run with triggers on.
SET LOCAL session_replication_role=replica;
TRUNCATE public."user",public.level,public.zsl_points_structure,
 public.statistics,zc_private.history_fact_dirty RESTART IDENTITY CASCADE;
INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE
SELECT n,1000000+n,false FROM generate_series(1,20) n;
INSERT INTO public.level(id,hash,xx_hash,date_created,publicly_visible) OVERRIDING SYSTEM VALUE
SELECT n,'plan-'||n,md5('plan-'||n),'2026-09-01Z',true FROM generate_series(1,2000) n;
INSERT INTO public.workshop_item(workshop_id,author_id,name,image_url,visibility)
SELECT n,1000001,'plan-'||n,'',0 FROM generate_series(1,2000) n;
INSERT INTO public.level_item(id_level,workshop_id,author_id,name,image_url,file_author,file_uid,
 validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,deleted,publicly_visible,created_at,updated_at)
SELECT n,n,1000001,'plan-'||n,'','plan','plan-'||n,0,0,0,0,false,true,'2026-09-01Z','2026-09-01Z'
FROM generate_series(1,2000) n;
INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created,record_eligible) OVERRIDING SYSTEM VALUE
SELECT 3800000+n,1+(n/2000)%20,1+n%2000,1000-n/40000+(n%2000)*0.0001,'test','test',
 '2026-09-26Z'::timestamptz+(n/4)*interval '1 second',n%97<>0
FROM generate_series(0,199999) n;
INSERT INTO public.personal_best_global(id_user,id_level,id_record,record_eligible)
SELECT id_user,id_level,id,record_eligible FROM public.record WHERE id>=3960000;
INSERT INTO public.world_record_global(id_user,id_level,id_record,record_eligible)
SELECT id_user,id_level,id,record_eligible FROM public.record WHERE id>=3960000 AND id<3962000;
INSERT INTO public.user_point_contribution(id_user,id_level,id_record,contribution_rank,level_position,
 level_points,level_decayed_points,player_decayed_points,date_calculated)
SELECT id_user,id_level,id,id_user,1,1000,100,100,'2026-09-27Z'
FROM public.record WHERE id>=3960000 AND id%2=0 AND record_eligible;
INSERT INTO zc_private.record_history_index(history_view,id,time,date_created,level_id,user_id,
 level_position,contribution_rank,level_points,level_decayed_points,player_decayed_points,
 is_personal_best,is_world_record,has_contribution,record_eligible)
SELECT category.history_view,r.id,r.time,r.date_created,r.id_level,r.id_user,
 c.level_position,c.contribution_rank,c.level_points,c.level_decayed_points,c.player_decayed_points,
 r.id>=3960000,r.id>=3960000 AND r.id<3962000,c.id_record IS NOT NULL,r.record_eligible
FROM public.record r LEFT JOIN public.user_point_contribution c ON c.id_record=r.id
CROSS JOIN LATERAL (VALUES('recent',true),('personal-bests',r.id>=3960000),
 ('world-records',r.id>=3960000 AND r.id<3962000)) category(history_view,include_row)
WHERE category.include_row;
INSERT INTO zc_private.record_history_fact
SELECT id,time,date_created,level_id,user_id,level_position,contribution_rank,level_points,
 level_decayed_points,player_decayed_points,is_personal_best,is_world_record,has_contribution,record_eligible
FROM zc_private.record_history_index WHERE history_view='recent';
UPDATE zc_private.history_fact_rollout SET backfill_after=3999999,backfill_done=true,
 verify_after=3999999,verified=true;
COMMIT;
ANALYZE public."user";
ANALYZE public.level;
ANALYZE public.level_item;
ANALYZE zc_private.record_history_index;
ANALYZE zc_private.record_history_fact;
SELECT zc_private.cutover_history_fact(true,true);
