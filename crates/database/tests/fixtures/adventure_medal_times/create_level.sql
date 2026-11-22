
        CREATE TABLE public.level(id integer PRIMARY KEY, adventure boolean NOT NULL, hash text NOT NULL);
        CREATE TABLE public.level_item(
            id integer PRIMARY KEY, id_level integer REFERENCES public.level,
            workshop_id bigint NOT NULL DEFAULT 0, author_id bigint NOT NULL DEFAULT 76561198041027402,
            file_uid text NOT NULL, deleted boolean NOT NULL DEFAULT false,
            validation_time_author real NOT NULL DEFAULT 0, validation_time_gold real NOT NULL DEFAULT 0,
            validation_time_silver real NOT NULL DEFAULT 0, validation_time_bronze real NOT NULL DEFAULT 0,
            updated_at timestamptz NOT NULL DEFAULT '2000-01-01', date_updated timestamptz
        );
        CREATE TABLE public.changes(id integer);
        CREATE FUNCTION public.capture_medal_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN INSERT INTO public.changes VALUES(NEW.id); RETURN NEW; END $$;
        CREATE TRIGGER medal_change AFTER UPDATE ON public.level_item
            FOR EACH ROW EXECUTE FUNCTION public.capture_medal_change();
        INSERT INTO public.level VALUES (1,true,'preserved'),(2,false,'non-adventure');
