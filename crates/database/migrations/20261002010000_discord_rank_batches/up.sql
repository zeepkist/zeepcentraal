CREATE TABLE zc_private.discord_rank_batch_state (
    id smallint PRIMARY KEY CHECK (id = 1),
    changes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(changes) = 'array'),
    window_started_at timestamptz,
    last_change_at timestamptz,
    CHECK ((window_started_at IS NULL) = (last_change_at IS NULL)),
    CHECK ((changes = '[]'::jsonb) = (window_started_at IS NULL))
);
INSERT INTO zc_private.discord_rank_batch_state (id) VALUES (1);
REVOKE ALL ON zc_private.discord_rank_batch_state FROM PUBLIC, zeepcentraal_graphql;
