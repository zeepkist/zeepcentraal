-- Synthetic fixture only. Caller holds a transaction and rolls it back.
DO $$ BEGIN
 IF current_database()<>'zc_optimization_test' THEN
  RAISE EXCEPTION 'Dedicated zc_optimization_test database required';
 END IF;
END $$;
SET LOCAL statement_timeout='60s';
SET LOCAL session_replication_role=replica;
TRUNCATE public."user",public.level,public.zsl_points_structure RESTART IDENTITY CASCADE;
INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE VALUES(1,1000001,false);
INSERT INTO public.level(id,hash,xx_hash,publicly_visible) OVERRIDING SYSTEM VALUE
SELECT n,'statistics-'||n,md5('statistics-'||n),true FROM generate_series(1,50000) n;
INSERT INTO public.workshop_item(workshop_id,author_id,name,image_url,visibility)
SELECT n,1000001,'statistics-'||n,'',0 FROM generate_series(1,50000) n;
INSERT INTO public.level_item(id_level,workshop_id,author_id,name,image_url,file_author,file_uid,
 validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,
 deleted,publicly_visible,created_at,updated_at)
SELECT n,n,1000001,'statistics-'||n,'','statistics','statistics-'||n,0,0,0,0,false,true,
 '2026-10-01Z','2026-10-01Z' FROM generate_series(1,50000) n;
INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created,record_eligible)
OVERRIDING SYSTEM VALUE
SELECT n,1,1+(n-1)%50000,n,'test','test','2026-10-18Z',true
FROM generate_series(1,200000) n;
INSERT INTO public.personal_best_global(id_user,id_level,id_record,record_eligible)
SELECT 1,n,n,true FROM generate_series(1,50000) n;
INSERT INTO public.world_record_global(id_user,id_level,id_record,record_eligible)
SELECT 1,n,n,true FROM generate_series(1,50000) n;
SET LOCAL session_replication_role=origin;
ANALYZE public.record;
ANALYZE public.personal_best_global;
ANALYZE public.world_record_global;
ANALYZE public.level;
ANALYZE public.level_item;
ANALYZE public."user";
SET LOCAL max_parallel_workers_per_gather=0;
