CREATE TABLE zc_private.zsl_admin_change (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity text NOT NULL CHECK (entity IN ('round', 'season', 'points', 'tournament', 'warmup')),
    entity_id integer NOT NULL,
    actor_steam_id bigint NOT NULL,
    previous jsonb,
    current jsonb NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX zsl_admin_change_entity ON zc_private.zsl_admin_change(entity, entity_id);

CREATE TABLE zc_private.zsl_playlist_revision (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    round_id integer NOT NULL REFERENCES public.zsl_round(id),
    kind text NOT NULL CHECK (kind IN ('tournament', 'warmup')),
    source text CHECK (octet_length(source) BETWEEN 1 AND 1048576),
    state text NOT NULL DEFAULT 'queued'
        CHECK (state IN ('queued', 'preparing', 'prepared', 'verified', 'failed')),
    diagnostics jsonb NOT NULL DEFAULT '[]',
    bundle jsonb,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK ((kind = 'tournament') = (source IS NOT NULL))
);
CREATE INDEX zsl_playlist_revision_round_kind ON zc_private.zsl_playlist_revision(round_id, kind, id DESC);

INSERT INTO zc_private.zsl_playlist_revision (round_id, kind)
SELECT id, 'warmup' FROM public.zsl_round WHERE event2_date > clock_timestamp();

CREATE TABLE zc_private.zsl_readiness_alert (
    round_id integer NOT NULL REFERENCES public.zsl_round(id),
    timeslot integer NOT NULL,
    starts_at timestamptz NOT NULL,
    hours integer NOT NULL,
    PRIMARY KEY (round_id, timeslot, starts_at, hours)
);
