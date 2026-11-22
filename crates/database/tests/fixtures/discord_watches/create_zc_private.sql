
        CREATE SCHEMA zc_private;
        CREATE TABLE public."user" (id integer PRIMARY KEY, steam_id bigint UNIQUE, steam_name varchar(255), discord_id bigint UNIQUE);
        CREATE TABLE zc_private.discord_watch (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            discord_id bigint NOT NULL, kind text NOT NULL, target_id text NOT NULL,
            paused boolean NOT NULL DEFAULT false, last_error text, last_delivery_key text,
            date_created timestamptz NOT NULL DEFAULT now(), date_updated timestamptz NOT NULL DEFAULT now(),
            UNIQUE(discord_id,kind,target_id)
        );
        INSERT INTO public."user" VALUES
            (11,76561198000000011,'FiXtUrE Ω🦀 player',555000000000000111), (12,NULL,NULL,NULL),
            (13,76561198000000013,'FiXtUrE Ω🦀 player',555000000000000113),
            (14,76561198000000014,'11',555000000000000114);
        INSERT INTO public."user"
            SELECT id,76561198000000000+id,'Batch ' || id,666000000000000000+id
            FROM generate_series(101,150) id;
