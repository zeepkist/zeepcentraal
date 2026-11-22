
CREATE TABLE public.level (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    publicly_visible boolean NOT NULL,
    date_created timestamptz NOT NULL
);
CREATE TABLE public.level_points (id_level integer PRIMARY KEY, points integer NOT NULL);
CREATE TABLE public."user" (id integer PRIMARY KEY, banned boolean NOT NULL DEFAULT false);
CREATE TABLE public.record (id integer PRIMARY KEY, id_user integer NOT NULL, id_level integer NOT NULL,
    time real NOT NULL, record_eligible boolean NOT NULL DEFAULT true, date_created timestamptz NOT NULL);
CREATE TABLE public.level_item (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_level integer NOT NULL, publicly_visible boolean NOT NULL, deleted boolean NOT NULL
);
CREATE TABLE public.track_tournament (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type integer NOT NULL, slug text NOT NULL, id_level integer NOT NULL,
    start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
    points_version integer NOT NULL DEFAULT 1, finalized_at timestamptz,
    date_created timestamptz NOT NULL DEFAULT now(), date_updated timestamptz,
    UNIQUE(type, id_level), UNIQUE(type, start_at), UNIQUE(type, slug),
    CHECK(end_at > start_at)
);
CREATE TABLE public.track_tournament_result (
    id_tournament integer NOT NULL, id_user integer NOT NULL, id_record integer NOT NULL,
    time real NOT NULL, rank integer NOT NULL, points integer NOT NULL,
    date_created timestamptz NOT NULL DEFAULT now(), date_updated timestamptz,
    PRIMARY KEY(id_tournament, id_user)
);
