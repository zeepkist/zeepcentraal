ALTER TABLE public.zsl_round
    ADD COLUMN submission_start timestamptz,
    ADD COLUMN submission_end timestamptz,
    ADD COLUMN zsl_vote_end timestamptz,
    ADD COLUMN cosmetic_vote_end timestamptz,
    ADD CONSTRAINT zsl_round_contest_schedule CHECK (
        (submission_start IS NULL AND submission_end IS NULL AND zsl_vote_end IS NULL AND cosmetic_vote_end IS NULL)
        OR (submission_start IS NOT NULL AND submission_end IS NOT NULL AND zsl_vote_end IS NOT NULL
            AND cosmetic_vote_end IS NOT NULL AND submission_start < submission_end
            AND submission_end < zsl_vote_end AND zsl_vote_end <= cosmetic_vote_end)
    );

ALTER TABLE zc_private.level_submissions
    ADD COLUMN level_hash text REFERENCES public.level(xx_hash),
    ADD COLUMN authors text[],
    ADD CONSTRAINT level_submission_authors_count CHECK (
        authors IS NULL OR cardinality(authors) BETWEEN 1 AND 3
    );
CREATE INDEX level_submission_hash ON zc_private.level_submissions(level_hash);

ALTER TABLE zc_private.level_submission_contest
    ADD COLUMN archive_object_key text,
    ADD COLUMN archive_sha256 text,
    ADD COLUMN archive_size bigint,
    ADD COLUMN finalized_at timestamptz,
    ADD CONSTRAINT submission_archive_complete CHECK (
        (archive_object_key IS NULL AND archive_sha256 IS NULL AND archive_size IS NULL AND finalized_at IS NULL)
        OR (archive_object_key IS NOT NULL AND archive_sha256 ~ '^[0-9a-f]{64}$'
            AND archive_size > 0 AND finalized_at IS NOT NULL)
    );

CREATE TABLE zc_private.level_submission_vote (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_contest bigint NOT NULL REFERENCES zc_private.level_submission_contest(id),
    id_user integer NOT NULL REFERENCES public."user"(id),
    id_level integer NOT NULL REFERENCES public.level(id),
    vote_type smallint NOT NULL CHECK (vote_type BETWEEN 1 AND 3),
    date_created timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT level_submission_vote_unique UNIQUE (id_contest, id_user, vote_type, id_level)
);
CREATE INDEX level_submission_vote_viewer ON zc_private.level_submission_vote(id_user, id_contest, vote_type);
CREATE INDEX level_submission_vote_tally ON zc_private.level_submission_vote(id_contest, vote_type, id_level);

-- Season names come from importer metadata. Only seed when exactly one Season 8 round 1 exists.
WITH current_round AS (
    SELECT r.id FROM public.zsl_round r
    JOIN public.zsl_season s ON s.id = r.id_season
    WHERE r.round = 1 AND s.name ~* '(^|[^0-9])8([^0-9]|$)'
), unique_round AS (
    SELECT id FROM current_round WHERE (SELECT count(*) FROM current_round) = 1
)
UPDATE public.zsl_round r SET
    submission_start = '2026-09-06 17:00:00+00',
    submission_end = '2026-09-27 17:00:00+00',
    zsl_vote_end = '2026-10-04 17:00:00+00',
    cosmetic_vote_end = r.event_date + interval '14 days'
FROM unique_round WHERE r.id = unique_round.id
    AND r.submission_start IS NULL;

-- Repair previously linked Season 8 submission contest, resolved by round number alone.
UPDATE zc_private.level_submission_contest c SET
    id_zsl_round = r.id,
    mapping_source = 'season-round-repair',
    date_updated = clock_timestamp()
FROM public.zsl_round r
JOIN public.zsl_season s ON s.id = r.id_season
WHERE c.season_number = 8 AND c.round_number = 1
    AND r.round = 1 AND s.name = 'Season 8'
    AND c.id_zsl_round IS DISTINCT FROM r.id;
