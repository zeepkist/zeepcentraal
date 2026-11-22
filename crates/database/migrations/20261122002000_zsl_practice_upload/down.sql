DELETE FROM zc_private.zsl_playlist_revision WHERE kind = 'practice';
DELETE FROM zc_private.zsl_admin_change WHERE entity = 'practice';

ALTER TABLE zc_private.zsl_playlist_revision
    DROP CONSTRAINT zsl_playlist_revision_kind_check,
    DROP CONSTRAINT zsl_playlist_revision_check,
    ADD CONSTRAINT zsl_playlist_revision_kind_check CHECK (kind IN ('tournament', 'warmup')),
    ADD CONSTRAINT zsl_playlist_revision_check CHECK ((kind = 'tournament') = (source IS NOT NULL));

ALTER TABLE zc_private.zsl_admin_change
    DROP CONSTRAINT zsl_admin_change_entity_check,
    ADD CONSTRAINT zsl_admin_change_entity_check
        CHECK (entity IN ('round', 'season', 'points', 'tournament', 'warmup'));
