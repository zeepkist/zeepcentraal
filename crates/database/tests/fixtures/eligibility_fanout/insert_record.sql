
      INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE VALUES(60000,2,1,0.01,'test','test');
      CREATE FUNCTION public.reject_eligibility_seed_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.task='fanOutRecordEligibility' THEN RAISE EXCEPTION 'fixture rollback'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_eligibility_seed_fixture BEFORE INSERT ON zc_jobs.job FOR EACH ROW EXECUTE FUNCTION public.reject_eligibility_seed_fixture();
