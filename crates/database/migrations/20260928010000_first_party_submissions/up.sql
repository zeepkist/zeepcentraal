-- Back up the database before applying: retired Discord source values are deleted.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM zc_private.level_submission_contest WHERE id_zsl_round IS NULL)
        OR EXISTS (SELECT id_zsl_round FROM zc_private.level_submission_contest GROUP BY id_zsl_round HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Submission contests require unique public round links before migration';
    END IF;
    IF EXISTS (SELECT 1 FROM zc_private.level_submissions s WHERE authors IS NULL
        OR array_ndims(authors)<>1 OR cardinality(authors) NOT BETWEEN 1 AND 3
        OR EXISTS (SELECT 1 FROM unnest(s.authors) a WHERE a IS NULL OR a !~ '^7656119[0-9]{10}$')
        OR cardinality(authors) <> (SELECT count(DISTINCT a) FROM unnest(s.authors) a)) THEN
        RAISE EXCEPTION 'Populate 1-3 distinct author Steam IDs on every submission before migration';
    END IF;
END $$;

CREATE FUNCTION zc_private.valid_submission_authors(value text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT array_ndims(value)=1 AND cardinality(value) BETWEEN 1 AND 3
        AND NOT EXISTS (SELECT 1 FROM unnest(value) a WHERE a IS NULL OR a !~ '^7656119[0-9]{10}$')
        AND cardinality(value) = (SELECT count(DISTINCT a) FROM unnest(value) a)
$$;

ALTER TABLE zc_private.level_submission_contest
    ALTER COLUMN id_zsl_round SET NOT NULL,
    ADD CONSTRAINT submission_contest_round_unique UNIQUE(id_zsl_round),
    ADD COLUMN playlist_revision bigint NOT NULL DEFAULT 1,
    ADD COLUMN published_revision bigint NOT NULL DEFAULT 0,
    ADD COLUMN next_finalization_at timestamptz NOT NULL DEFAULT now(),
    DROP COLUMN thread_id,
    DROP COLUMN guild_id,
    DROP COLUMN forum_id,
    DROP COLUMN title,
    DROP COLUMN theme,
    DROP COLUMN season_number,
    DROP COLUMN round_number,
    DROP COLUMN mapping_source,
    DROP COLUMN publication;

ALTER TABLE zc_private.level_submissions
    ALTER COLUMN authors SET NOT NULL,
    DROP CONSTRAINT level_submission_authors_count,
    ADD CONSTRAINT level_submission_authors_valid CHECK(zc_private.valid_submission_authors(authors)),
    ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK(revision > 0),
    ADD COLUMN next_inspection_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN inspection_started_at timestamptz,
    DROP COLUMN message_id,
    DROP COLUMN author_id,
    DROP COLUMN message_created_at,
    DROP COLUMN message_edited_at,
    DROP COLUMN source_error,
    DROP COLUMN last_seen;
CREATE INDEX submission_authors ON zc_private.level_submissions USING gin(authors);
CREATE INDEX submission_inspection_due ON zc_private.level_submissions(next_inspection_at) WHERE state='selected';
CREATE UNIQUE INDEX submission_selected_workshop ON zc_private.level_submissions(id_contest,workshop_id) WHERE state='selected';

ALTER TABLE zc_private.level_submission_validation
    ADD COLUMN submission_revision bigint NOT NULL DEFAULT 1;

-- Only fresh validations create these rows. Existing validations are not backfilled.
CREATE TABLE zc_private.level_submission_notification (
    id_submission bigint PRIMARY KEY REFERENCES zc_private.level_submissions(id),
    desired_revision bigint NOT NULL,
    desired_validation_id bigint REFERENCES zc_private.level_submission_validation(id),
    delivered_revision bigint,
    delivered_validation_id bigint REFERENCES zc_private.level_submission_validation(id),
    message_id text,
    payload_digest text,
    attempt_started_at timestamptz,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    last_error text,
    date_updated timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submission_notification_due ON zc_private.level_submission_notification(next_attempt_at);

ALTER TABLE zc_private.level_submission_contest
    DROP CONSTRAINT level_submission_contest_id_zsl_round_zsl_round_id_fk,
    ADD CONSTRAINT submission_contest_round_fkey FOREIGN KEY(id_zsl_round) REFERENCES public.zsl_round(id) ON DELETE RESTRICT;
