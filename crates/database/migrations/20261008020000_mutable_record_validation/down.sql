-- Rollback restores schema only; deleted observations cannot be recovered.
ALTER TABLE zc_private.record_validation
    DROP CONSTRAINT record_validation_id_record_key,
    ALTER COLUMN id_record DROP NOT NULL,
    ALTER COLUMN id_level DROP NOT NULL,
    DROP COLUMN updated_at,
    ADD COLUMN level_xx_hash text;
UPDATE zc_private.record_validation v SET level_xx_hash=l.xx_hash
FROM public.level l WHERE l.id=v.id_level;
CREATE INDEX record_validation_record ON zc_private.record_validation(id_record,id DESC);

CREATE TABLE zc_private.level_version_lineage (
    id_level integer NOT NULL REFERENCES public.level(id),
    workshop_id bigint NOT NULL,
    file_uid text NOT NULL,
    source text NOT NULL,
    observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(id_level,workshop_id,file_uid,source)
);
CREATE INDEX level_version_lineage_lookup ON zc_private.level_version_lineage(file_uid,workshop_id,id_level);
INSERT INTO zc_private.level_version_lineage(id_level,workshop_id,file_uid,source)
SELECT DISTINCT id_level,workshop_id,file_uid,'current_membership_seed' FROM public.level_item
ON CONFLICT DO NOTHING;
CREATE FUNCTION zc_private.immutable_validation_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'validation evidence is immutable'; END $$;
CREATE TRIGGER immutable_level_version_lineage BEFORE UPDATE OR DELETE ON zc_private.level_version_lineage FOR EACH ROW EXECUTE FUNCTION zc_private.immutable_validation_evidence();
CREATE TRIGGER immutable_record_validation BEFORE UPDATE OR DELETE ON zc_private.record_validation FOR EACH ROW EXECUTE FUNCTION zc_private.immutable_validation_evidence();
REVOKE ALL ON zc_private.level_version_lineage FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT FROM pg_roles WHERE rolname='zeepcentraal_graphql') THEN
REVOKE ALL ON zc_private.level_version_lineage FROM zeepcentraal_graphql;
END IF; END $$;
