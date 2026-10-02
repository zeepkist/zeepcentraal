DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM zc_private.discord_rank_batch_state WHERE changes <> '[]'::jsonb) THEN
        RAISE EXCEPTION 'Pending Discord rank changes must be flushed before rollback';
    END IF;
END
$$;
DROP TABLE zc_private.discord_rank_batch_state;
