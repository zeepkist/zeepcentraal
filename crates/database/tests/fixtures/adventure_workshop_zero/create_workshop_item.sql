
        CREATE TABLE public.workshop_item (
            workshop_id bigint PRIMARY KEY, author_id bigint NOT NULL,
            name text NOT NULL, image_url text NOT NULL DEFAULT '',
            visibility smallint NOT NULL DEFAULT 0, publicly_visible boolean NOT NULL DEFAULT true,
            file_size integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
            date_created timestamptz NOT NULL DEFAULT now(), date_updated timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE public.level(id integer PRIMARY KEY, adventure boolean NOT NULL);
        CREATE TABLE public.level_item(
            id integer PRIMARY KEY, id_level integer REFERENCES public.level,
            workshop_id bigint REFERENCES public.workshop_item, author_id bigint NOT NULL,
            file_uid text NOT NULL, deleted boolean NOT NULL DEFAULT false,
            publicly_visible boolean NOT NULL DEFAULT true
        );
        CREATE TABLE public.item_changes(id integer);
        CREATE FUNCTION public.capture_item_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN INSERT INTO public.item_changes VALUES(NEW.id); RETURN NEW; END $$;
        CREATE TRIGGER item_change AFTER UPDATE OF workshop_id ON public.level_item
            FOR EACH ROW EXECUTE FUNCTION public.capture_item_change();
        INSERT INTO public.workshop_item(workshop_id,author_id,name) VALUES
            (-1,76561198041027402,'Official Adventure'), (123,42,'Workshop upload');
        INSERT INTO public.level VALUES(1,true),(2,false);
        INSERT INTO public.level_item(id,id_level,workshop_id,author_id,file_uid,deleted) VALUES
            (1,1,-1,76561198041027402,'ea1',false),
            (2,1,-1,76561198041027402,'old-version',true),
            (3,1,123,42,'workshop-copy',false),
            (4,2,-1,76561198041027402,'non-adventure',false),
            (5,1,-1,42,'other-author',false);
        GRANT USAGE ON SCHEMA public TO zeepcentraal_graphql;
        GRANT SELECT ON public.level_item,public.workshop_item TO zeepcentraal_graphql;
