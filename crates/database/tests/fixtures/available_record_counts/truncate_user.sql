
      TRUNCATE public."user",public.level,public.workshop_item,zc_jobs.job RESTART IDENTITY CASCADE;
      INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE SELECT id,42+id,false FROM generate_series(1,56) id;
      INSERT INTO public.level(id,hash,xx_hash) OVERRIDING SYSTEM VALUE SELECT id,'count-'||id,lpad(id::text,32,'0') FROM generate_series(1,4) id;
      INSERT INTO public.workshop_item(workshop_id,author_id,name,image_url) VALUES(1,43,'counts',''),(2,43,'duplicate','');
      INSERT INTO public.level_item(id,id_level,workshop_id,author_id,name,image_url,file_author,file_uid,
        validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,deleted,created_at,updated_at)
      OVERRIDING SYSTEM VALUE VALUES
        (10,1,1,43,'count','','fixture','one',10,11,12,13,false,now(),now()),
        (11,1,2,43,'duplicate','','fixture','two',10,11,12,13,false,now(),now()),
        (12,3,1,43,'deleted','','fixture','three',10,11,12,13,true,now(),now()),
        (13,4,1,43,'failed','','fixture','four',10,11,12,13,false,now(),now());
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE
        SELECT id,id,1,10+id::real/100,'test','test',CASE WHEN id%2=0 THEN '2020-01-01'::timestamptz ELSE now() END FROM generate_series(1,56) id;
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version,date_created) OVERRIDING SYSTEM VALUE
        VALUES(57,2,2,10,'test','test','2020-01-01'),(58,1,3,10,'test','test',now()),(59,2,4,10,'test','test','2020-01-01');
      INSERT INTO public.personal_best_global(id_user,id_level,id_record) SELECT id,id_level,id FROM public.record WHERE id<=56;
      INSERT INTO public.personal_best_global(id_user,id_level,id_record) VALUES(2,2,57),(1,3,58),(2,4,59);
      INSERT INTO public.world_record_global(id_user,id_level,id_record) VALUES(1,1,1),(2,2,57),(1,3,58),(2,4,59);
      INSERT INTO public.user_points(id_user,points,total_points,rank,world_records) VALUES(1,42,99,7,88),(56,0,0,-1,88);
