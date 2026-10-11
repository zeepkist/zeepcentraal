-- Disposable fixture only. Matches submission service columns after Diesel migrations.
CREATE TABLE public.workshop_item (workshop_id bigint PRIMARY KEY, image_url text NOT NULL DEFAULT '');
CREATE TABLE public.level_item (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id_level integer NOT NULL REFERENCES public.level(id), workshop_id bigint NOT NULL, image_url text NOT NULL DEFAULT '');
ALTER TABLE public.zsl_round ADD COLUMN submission_start timestamptz, ADD COLUMN submission_end timestamptz,
 ADD COLUMN zsl_vote_end timestamptz, ADD COLUMN cosmetic_vote_end timestamptz, ADD COLUMN steam_announcement_id bigint;
CREATE TABLE zc_private.level_submission_contest (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id_zsl_round integer NOT NULL UNIQUE REFERENCES public.zsl_round(id),
 state text NOT NULL DEFAULT 'open', rules jsonb NOT NULL DEFAULT '{}', rules_hash text NOT NULL DEFAULT 'fixture',
 current_playlist_id bigint, playlist_revision bigint NOT NULL DEFAULT 1, published_revision bigint NOT NULL DEFAULT 0,
 finalized_at timestamptz, frozen_at timestamptz, next_finalization_at timestamptz NOT NULL DEFAULT now(),
 date_created timestamptz NOT NULL DEFAULT now(), date_updated timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE zc_private.level_submissions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id_contest bigint NOT NULL REFERENCES zc_private.level_submission_contest(id),
 workshop_id bigint NOT NULL, authors text[] NOT NULL, state text NOT NULL DEFAULT 'selected', revision bigint NOT NULL DEFAULT 1,
 latest_validation_id bigint, level_hash text REFERENCES public.level(xx_hash), retry_category text,
 inspection_started_at timestamptz, next_inspection_at timestamptz NOT NULL DEFAULT now(),
 date_created timestamptz NOT NULL DEFAULT now(), date_updated timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE zc_private.level_submission_validation (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id_submission bigint NOT NULL REFERENCES zc_private.level_submissions(id),
 submission_revision bigint NOT NULL, valid boolean NOT NULL, file_uid text, payload jsonb
);
CREATE TABLE zc_private.level_submission_playlist (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id_contest bigint NOT NULL REFERENCES zc_private.level_submission_contest(id),
 digest text NOT NULL, valid_count integer NOT NULL, object_key text NOT NULL, date_created timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id_contest,digest)
);
CREATE TABLE zc_private.level_submission_playlist_entry (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id_playlist bigint NOT NULL REFERENCES zc_private.level_submission_playlist(id),
 position integer NOT NULL, id_validation bigint NOT NULL REFERENCES zc_private.level_submission_validation(id), workshop_id bigint NOT NULL
);
