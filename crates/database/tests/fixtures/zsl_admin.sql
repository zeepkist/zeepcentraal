ALTER TABLE public.zsl_points_structure
    ADD COLUMN date_created timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN date_updated timestamptz;
ALTER TABLE public.zsl_round
    ADD COLUMN submission_start timestamptz,
    ADD COLUMN submission_end timestamptz,
    ADD COLUMN zsl_vote_end timestamptz,
    ADD COLUMN cosmetic_vote_end timestamptz,
    ADD COLUMN steam_announcement_id bigint;
ALTER TABLE public."user" ADD COLUMN role text;
CREATE TABLE zc_private.level_submission_contest (id_zsl_round integer);
