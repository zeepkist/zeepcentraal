-- Minimal isolated eligibility consumers. Trigger body comes from production migration.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='timing_recovery_reader') THEN
  CREATE ROLE timing_recovery_reader;
 END IF;
END $$;
CREATE SCHEMA zc_jobs;
CREATE TABLE zc_jobs.job(job_key text PRIMARY KEY,task text,payload jsonb);
CREATE FUNCTION zc_jobs.enqueue(text,text,jsonb,text,text,integer,timestamptz) RETURNS text LANGUAGE sql AS $$
 INSERT INTO zc_jobs.job VALUES($4,$2,$3) ON CONFLICT(job_key) DO UPDATE SET payload=excluded.payload RETURNING job_key
$$;
ALTER TABLE public.record ADD COLUMN record_eligible boolean NOT NULL DEFAULT true;
ALTER TABLE public.record ADD UNIQUE(id,record_eligible);
ALTER TABLE public.record_media ADD COLUMN record_eligible boolean NOT NULL DEFAULT true;
ALTER TABLE public.record_media ADD FOREIGN KEY(id_record,record_eligible) REFERENCES public.record(id,record_eligible) ON UPDATE CASCADE;
INSERT INTO public."user"(id,steam_id) VALUES(1,42);
INSERT INTO public.level(id,xx_hash,record_count) VALUES(1,repeat('a',32),3);
INSERT INTO public.record(id,id_user,id_level,time) VALUES(1,1,1,10),(2,1,1,11),(3,1,1,12);
INSERT INTO public.record_media(id_record,ghost_url) VALUES(1,'fixture-ghost');
