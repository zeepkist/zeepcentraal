DROP TRIGGER immutable_record_validation ON zc_private.record_validation;
DROP TABLE zc_private.level_version_lineage;
DROP FUNCTION zc_private.immutable_validation_evidence();

-- Intentional reset: previous attempts and candidate comparisons are discarded.
TRUNCATE zc_private.record_validation RESTART IDENTITY;
DROP INDEX zc_private.record_validation_record;
ALTER TABLE zc_private.record_validation
    DROP COLUMN level_xx_hash,
    ALTER COLUMN id_record SET NOT NULL,
    ALTER COLUMN id_level SET NOT NULL,
    ADD CONSTRAINT record_validation_id_record_key UNIQUE (id_record),
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp();
