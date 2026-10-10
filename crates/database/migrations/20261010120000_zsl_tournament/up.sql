CREATE TABLE zc_private.zsl_tournament_state (
    id_round integer PRIMARY KEY REFERENCES public.zsl_round(id),
    owner text NOT NULL,
    lease_until timestamptz NOT NULL,
    state jsonb NOT NULL DEFAULT '{}'::jsonb,
    published_at timestamptz,
    date_updated timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE zc_private.zsl_tournament_level_state (
    id_round integer NOT NULL REFERENCES public.zsl_round(id),
    timeslot integer NOT NULL CHECK (timeslot IN (1,2)),
    playlist_index integer NOT NULL CHECK (playlist_index >= 0),
    id_level integer REFERENCES public.zsl_level(id),
    deadline timestamptz NOT NULL,
    closed boolean NOT NULL DEFAULT false,
    PRIMARY KEY (id_round,timeslot,playlist_index)
);
CREATE TABLE zc_private.zsl_provisional_level_result (
    id_level integer NOT NULL REFERENCES public.zsl_level(id),
    id_user integer NOT NULL REFERENCES public."user"(id),
    time numeric(14,6) NOT NULL CHECK (time > 0),
    timeslot integer NOT NULL CHECK (timeslot IN (1,2)),
    finalised boolean NOT NULL DEFAULT false,
    date_created timestamptz NOT NULL DEFAULT clock_timestamp(),
    date_updated timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (id_level,id_user)
);
REVOKE ALL ON zc_private.zsl_tournament_state, zc_private.zsl_tournament_level_state,
    zc_private.zsl_provisional_level_result FROM PUBLIC;
COMMENT ON TABLE zc_private.zsl_provisional_level_result IS '@omit';
COMMENT ON TABLE zc_private.zsl_tournament_state IS '@omit';
COMMENT ON TABLE zc_private.zsl_tournament_level_state IS '@omit';
