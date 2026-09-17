-- Synthetic evaluation schema, NOT the production migration baseline.
CREATE TABLE public."user" (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    steam_id bigint NOT NULL UNIQUE,
    steam_name text NOT NULL,
    banned boolean NOT NULL DEFAULT false
);
CREATE TABLE public.level (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    xx_hash text NOT NULL UNIQUE
);
CREATE TABLE public.record (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_user integer NOT NULL REFERENCES public."user"(id),
    id_level integer NOT NULL REFERENCES public.level(id),
    time double precision NOT NULL CHECK (time > 0 AND time < 'Infinity'::float8)
);
CREATE INDEX record_leaderboard ON public.record (id_level, time, id_user);
CREATE TABLE public.record_audit (
    id_record integer PRIMARY KEY REFERENCES public.record(id)
);
CREATE VIEW public.leaderboard AS
SELECT id_level, id_user, min(time) AS time FROM public.record GROUP BY id_level,id_user;
CREATE FUNCTION public.preview_notify() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify('postrust_' || TG_TABLE_SCHEMA || '_' || TG_TABLE_NAME,
        json_build_object('operation', TG_OP, 'schema', TG_TABLE_SCHEMA, 'table', TG_TABLE_NAME)::text);
    RETURN NULL;
END;
$$;
CREATE TRIGGER record_notify AFTER INSERT OR UPDATE OR DELETE ON public.record
FOR EACH STATEMENT EXECUTE FUNCTION public.preview_notify();
CREATE TRIGGER user_notify AFTER INSERT OR UPDATE OR DELETE ON public."user"
FOR EACH STATEMENT EXECUTE FUNCTION public.preview_notify();
CREATE TRIGGER level_notify AFTER INSERT OR UPDATE OR DELETE ON public.level
FOR EACH STATEMENT EXECUTE FUNCTION public.preview_notify();
INSERT INTO public."user"(steam_id,steam_name) VALUES (76561198000000001,'Preview Racer'),(76561198000000002,'Rust Racer');
INSERT INTO public.level(name,xx_hash) VALUES ('Preview Hill','11111111111111111111111111111111'),('Preview Circuit','22222222222222222222222222222222');
INSERT INTO public.record(id_user,id_level,time) VALUES (1,1,30.5),(2,1,29.75),(1,2,65.125);

