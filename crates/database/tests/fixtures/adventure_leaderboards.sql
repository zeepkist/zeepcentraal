-- Minimal disposable schema: exercise view permissions under real RLS.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO zeepcentraal_graphql;
CREATE TABLE public."user"(id integer PRIMARY KEY,banned boolean NOT NULL DEFAULT false);
CREATE TABLE public.level(id integer PRIMARY KEY,adventure boolean NOT NULL DEFAULT true,publicly_visible boolean NOT NULL DEFAULT true);
CREATE TABLE public.level_item(id integer PRIMARY KEY,id_level integer REFERENCES public.level,name text NOT NULL,deleted boolean NOT NULL DEFAULT false);
CREATE TABLE public.record(id integer PRIMARY KEY,id_user integer REFERENCES public."user",id_level integer REFERENCES public.level,time real NOT NULL,record_eligible boolean NOT NULL DEFAULT true);
CREATE TABLE public.personal_best_global(id_user integer REFERENCES public."user",id_level integer REFERENCES public.level,id_record integer REFERENCES public.record,record_eligible boolean NOT NULL DEFAULT true,PRIMARY KEY(id_user,id_level));
ALTER TABLE public.record ENABLE ROW LEVEL SECURITY;
CREATE POLICY eligible ON public.record FOR SELECT TO zeepcentraal_graphql USING(record_eligible);
ALTER TABLE public.personal_best_global ENABLE ROW LEVEL SECURITY;
CREATE POLICY eligible ON public.personal_best_global FOR SELECT TO zeepcentraal_graphql USING(record_eligible);
GRANT SELECT ON ALL TABLES IN SCHEMA public TO zeepcentraal_graphql;
INSERT INTO public."user" SELECT i,false FROM generate_series(1,65) i;
INSERT INTO public.level SELECT i,true,true FROM generate_series(1,19) i;
INSERT INTO public.level_item VALUES(1,1,'A-01',false),(2,1,'A-01',false),(3,2,'A-02',false),(4,1,'B-01',false),(5,3,'B-02',false);
INSERT INTO public.level_item SELECT i+10,i+3,upper(s)||'-01',false FROM unnest(ARRAY['c','cl','d','e','ez','f','fl','g','h','i','l','or','x','xg','y']) WITH ORDINALITY x(s,i);
INSERT INTO public.level_item VALUES(100,19,'A-malformed',false);
INSERT INTO public.record VALUES(1,1,1,60.0004,true),(2,1,2,60.0004,true),(3,2,1,60.00049,true),(4,2,2,60.00049,true),(5,3,1,1,true),(6,4,2,1,true),(7,5,1,2,true);
INSERT INTO public.personal_best_global SELECT id_user,id_level,id,record_eligible FROM public.record;
-- More than one cursor page; IDs break ties without affecting displayed rank.
INSERT INTO public.record SELECT 100+i,i,1,3,true FROM generate_series(6,65) i;
INSERT INTO public.personal_best_global SELECT id_user,id_level,id,true FROM public.record WHERE id>=100;
