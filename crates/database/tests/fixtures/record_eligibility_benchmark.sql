-- Synthetic data only. Caller must guard isolated benchmark database name.
INSERT INTO public."user"(id,steam_id) OVERRIDING SYSTEM VALUE
 SELECT id,id+100000 FROM generate_series(1,200) id;
INSERT INTO public.level(id,hash,xx_hash,adventure,publicly_visible,record_count) OVERRIDING SYSTEM VALUE
 SELECT id,'fixture-'||id,md5(id::text),true,true,CASE WHEN id=49122 THEN 77 ELSE 80 END
 FROM generate_series(1,49122) id;
ALTER TABLE public.record DISABLE TRIGGER USER;
INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE
 SELECT id,(id-1)%200+1,(id-1)/80+1,10+(id%100)::real/100,'fixture','fixture','2026-01-01'
 FROM generate_series(1,3929757) id;
ALTER TABLE public.record ENABLE TRIGGER USER;
ALTER TABLE zc_private.record_validation DISABLE TRIGGER USER;
INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version)
 SELECT id,(id-1)%200+1,(id-1)/80+1,
 CASE WHEN permutation<626386 THEN 'fail' WHEN permutation<628434 THEN 'pass' ELSE 'uncertain' END,
 '{}'::jsonb,'fixture'
 FROM (SELECT id,(id::bigint*1048573)%3929757 AS permutation FROM generate_series(1,3929757) id) source;
ALTER TABLE zc_private.record_validation ENABLE TRIGGER USER;
ANALYZE public.record;
ANALYZE zc_private.record_validation;
ANALYZE public.level;
