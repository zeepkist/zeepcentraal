DROP SCHEMA public CASCADE;
DROP SCHEMA zc_private CASCADE;
DROP SCHEMA zc_jobs CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA zc_private;
CREATE SCHEMA zc_jobs;
GRANT USAGE ON SCHEMA public,zc_private TO zeepcentraal_graphql;
CREATE TABLE public."user"(id integer PRIMARY KEY,banned boolean NOT NULL DEFAULT false,steam_id bigint,discord_id bigint);
CREATE TABLE public.level(id integer PRIMARY KEY,xx_hash text,publicly_visible boolean NOT NULL DEFAULT true);
CREATE TABLE public.level_item(id integer PRIMARY KEY,id_level integer REFERENCES public.level,validation_time_author real,validation_time_gold real,validation_time_silver real,validation_time_bronze real,updated_at timestamptz DEFAULT now(),deleted boolean NOT NULL DEFAULT false,publicly_visible boolean NOT NULL DEFAULT true);
CREATE TABLE public.record(id integer PRIMARY KEY,id_user integer REFERENCES public."user",id_level integer REFERENCES public.level,time real,record_eligible boolean NOT NULL DEFAULT true,date_created timestamptz DEFAULT now());
CREATE TABLE public.personal_best_global(id integer PRIMARY KEY,id_user integer REFERENCES public."user",id_level integer REFERENCES public.level,id_record integer REFERENCES public.record,record_eligible boolean NOT NULL DEFAULT true,UNIQUE(id_user,id_level));
CREATE TABLE public.user_points(id_user integer PRIMARY KEY REFERENCES public."user",points integer NOT NULL DEFAULT 123);
CREATE VIEW public.record_history_entry AS SELECT id FROM public.record;
CREATE TABLE zc_jobs.job(task text,payload jsonb,job_key text PRIMARY KEY);
CREATE FUNCTION zc_jobs.enqueue(text,text,jsonb,text,text,integer,timestamptz) RETURNS void LANGUAGE sql AS $$
 INSERT INTO zc_jobs.job VALUES($2,$3,$4) ON CONFLICT(job_key) DO UPDATE SET payload=excluded.payload
$$;
CREATE FUNCTION public.tg__live_query_invalidate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
ALTER TABLE public.record ENABLE ROW LEVEL SECURITY;
CREATE POLICY eligible ON public.record FOR SELECT TO zeepcentraal_graphql USING(record_eligible);
GRANT SELECT ON ALL TABLES IN SCHEMA public TO zeepcentraal_graphql;
INSERT INTO public."user" SELECT id,false,10000+id,20000+id FROM generate_series(1,15) id;
INSERT INTO public.level VALUES(1,repeat('a',32)),(2,repeat('b',32)),(3,repeat('c',32));
INSERT INTO public.level_item(id,id_level,validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze)
 SELECT id,id,40,45,50,60 FROM generate_series(1,3) id;
INSERT INTO public.record(id,id_user,id_level,time)
 SELECT position,position,1,time FROM unnest(ARRAY[35.2,35.8,36.1,36.4,36.7,36.9,37.2,37.5,38.0,38.4]::real[]) WITH ORDINALITY x(time,position);
INSERT INTO public.personal_best_global SELECT id,id_user,id_level,id,true FROM public.record;
INSERT INTO public.record(id,id_user,id_level,time) SELECT 100+id,id,2,35+id/10.0 FROM generate_series(1,9) id;
INSERT INTO public.personal_best_global SELECT id,id_user,id_level,id,true FROM public.record WHERE id>100;
