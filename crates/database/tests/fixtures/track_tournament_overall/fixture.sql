
CREATE SCHEMA zc_private;
GRANT USAGE ON SCHEMA zc_private TO zeepcentraal_graphql;
CREATE TABLE public."user"(id integer PRIMARY KEY,steam_name text);
CREATE TABLE public.level(id integer PRIMARY KEY,publicly_visible boolean NOT NULL DEFAULT true);
CREATE TABLE public.record(id integer PRIMARY KEY,record_eligible boolean NOT NULL DEFAULT true);
CREATE TABLE public.track_tournament(
 id integer PRIMARY KEY,type integer NOT NULL,id_level integer NOT NULL REFERENCES public.level,
 start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,finalized_at timestamptz
);
CREATE TABLE public.track_tournament_result(
 id_tournament integer REFERENCES public.track_tournament ON DELETE CASCADE,
 id_user integer REFERENCES public."user" ON DELETE CASCADE,id_record integer REFERENCES public.record,
 points integer NOT NULL,PRIMARY KEY(id_tournament,id_user)
);
INSERT INTO public."user" SELECT i,'Player '||i FROM generate_series(1,5) i;
INSERT INTO public.level SELECT i,true FROM generate_series(1,40) i;
INSERT INTO public.record SELECT i,true FROM generate_series(1,5) i;
INSERT INTO public.track_tournament
 SELECT i,0,i,'2026-01-01'::timestamptz+i*interval '1 week',
 '2026-01-08'::timestamptz+i*interval '1 week','2026-10-01'::timestamptz FROM generate_series(1,15) i;
INSERT INTO public.track_tournament
 SELECT i,1,i,'2024-01-01'::timestamptz+i*interval '1 month',
 '2024-02-01'::timestamptz+i*interval '1 month','2026-10-01'::timestamptz FROM generate_series(20,27) i;
INSERT INTO public.track_tournament_result
 SELECT t.id,u.id,u.id,1000 FROM public.track_tournament t CROSS JOIN public."user" u WHERE u.id IN(1,2);
INSERT INTO public.track_tournament_result VALUES(15,3,3,500),(1,4,4,1000),(27,4,4,1000);
