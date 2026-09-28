ALTER TABLE public.zsl_round
    ADD COLUMN steam_announcement_id bigint,
    ADD CONSTRAINT zsl_round_steam_announcement_positive CHECK (steam_announcement_id > 0);

UPDATE public.zsl_round SET steam_announcement_id = 705530288588981646
WHERE id = 50 AND id_season = 8 AND round = 1 AND steam_announcement_id IS NULL;
