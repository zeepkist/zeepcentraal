DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='zeepcentraal_graphql') THEN CREATE ROLE zeepcentraal_graphql; END IF; END $$;
         CREATE TABLE public.level (
             id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
             hash text NOT NULL, xx_hash text UNIQUE NOT NULL, adventure boolean NOT NULL DEFAULT false,
             has_records boolean NOT NULL DEFAULT false,record_count bigint NOT NULL DEFAULT 0,
             publicly_visible boolean NOT NULL DEFAULT true,date_created timestamptz NOT NULL DEFAULT now(),date_updated timestamptz
         );
         CREATE TABLE public.level_metadata (
             id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_level integer NOT NULL REFERENCES public.level,
             format integer NOT NULL,blocks jsonb NOT NULL
         );
         GRANT USAGE ON SCHEMA public TO zeepcentraal_graphql;
         GRANT SELECT ON public.level TO zeepcentraal_graphql;
         ALTER TABLE public.level ENABLE ROW LEVEL SECURITY;
         CREATE POLICY visible_level ON public.level FOR SELECT TO zeepcentraal_graphql USING(publicly_visible);
