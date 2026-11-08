-- Only loaded by guarded disposable Adventure verification script.
TRUNCATE public."user",public.level,public.workshop_item,zc_jobs.job RESTART IDENTITY CASCADE;
INSERT INTO public."user"(id,steam_id,steam_name,banned) OVERRIDING SYSTEM VALUE
 SELECT i,76561198000000000+i,'Adventure Player '||i,false FROM generate_series(1,65) i;
INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE
 SELECT i,'adventure-fixture-'||i,lpad(i::text,32,'0'),true FROM generate_series(1,18) i;
INSERT INTO public.workshop_item(workshop_id,author_id,name,image_url) VALUES(1,76561198000000001,'Adventure fixture','');
INSERT INTO public.level_item(id,id_level,workshop_id,author_id,name,image_url,file_author,file_uid,
 validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,deleted,created_at,updated_at)
 OVERRIDING SYSTEM VALUE
 SELECT i,i,1,76561198000000001,name,'','fixture','adventure-'||i,10,11,12,13,false,now(),now()
 FROM unnest(ARRAY['A-01','A-02','B-02','C-01','CL-01','D-01','E-01','EZ-01','F-01','FL-01','G-01','H-01','I-01','L-01','OR-01','X-01','XG-01','Y-01']) WITH ORDINALITY x(name,i);
INSERT INTO public.level_item(id,id_level,workshop_id,author_id,name,image_url,file_author,file_uid,
 validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,deleted,created_at,updated_at)
 OVERRIDING SYSTEM VALUE VALUES(19,1,1,76561198000000001,'B-01','','fixture','shared-b',10,11,12,13,false,now(),now());
INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
 SELECT i,i,1,CASE WHEN i<=2 THEN 60 ELSE 1+i::real/100 END,'test','test' FROM generate_series(1,65) i;
INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
 VALUES(66,1,2,60,'test','test'),(67,2,2,60,'test','test');
INSERT INTO public.personal_best_global(id_user,id_level,id_record) SELECT id_user,id_level,id FROM public.record;
