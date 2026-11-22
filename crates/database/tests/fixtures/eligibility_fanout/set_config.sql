
      BEGIN;
      SELECT set_config('zc.validation_correction','on',true);
      INSERT INTO public.level(id,hash,xx_hash) OVERRIDING SYSTEM VALUE
        SELECT id,'other-'||id,lpad(to_hex(id),32,'0') FROM generate_series(4,50003) id;
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
        SELECT id+19,1,id,7,'test','test' FROM generate_series(4,50003) id;
      INSERT INTO public.personal_best_global(id_user,id_level,id_record)
        SELECT 1,id,id+19 FROM generate_series(4,50003) id;
      COMMIT;
