CREATE SCHEMA IF NOT EXISTS zc_private;
-- Geometry stays in public.level_metadata, keyed by public.level.xx_hash through level.id.
-- level_item is mutable: retain only historical workshop/UID membership, once per version.
CREATE TABLE zc_private.level_version_lineage (
 id_level integer NOT NULL REFERENCES public.level(id),
 workshop_id bigint NOT NULL,
 file_uid text NOT NULL,
 source text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(id_level,workshop_id,file_uid,source)
);
CREATE INDEX level_version_lineage_lookup ON zc_private.level_version_lineage(file_uid,workshop_id,id_level);
CREATE TABLE zc_private.record_validation (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_record integer REFERENCES public.record(id),
 id_user integer NOT NULL REFERENCES public."user"(id),
 id_level integer REFERENCES public.level(id),
 ghost_digest text,
 level_xx_hash text,
 status text NOT NULL CHECK(status IN ('pending','pass','fail','uncertain')),
 report jsonb NOT NULL,
 validator_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX record_validation_record ON zc_private.record_validation(id_record,id DESC);
CREATE TABLE zc_private.record_run (
 id_user integer NOT NULL REFERENCES public."user"(id),
 run_uuid text NOT NULL,
 payload_digest text NOT NULL,
 id_record integer NOT NULL REFERENCES public.record(id),
 PRIMARY KEY(id_user,run_uuid)
);
-- Seed current memberships only. Observation time never implies a level update date.
INSERT INTO zc_private.level_version_lineage(id_level,workshop_id,file_uid,source)
SELECT DISTINCT id_level,workshop_id,file_uid,'current_membership_seed' FROM public.level_item
ON CONFLICT DO NOTHING;
CREATE FUNCTION zc_private.immutable_validation_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'validation evidence is immutable'; END $$;
CREATE TRIGGER immutable_level_version_lineage BEFORE UPDATE OR DELETE ON zc_private.level_version_lineage FOR EACH ROW EXECUTE FUNCTION zc_private.immutable_validation_evidence();
CREATE TRIGGER immutable_record_validation BEFORE UPDATE OR DELETE ON zc_private.record_validation FOR EACH ROW EXECUTE FUNCTION zc_private.immutable_validation_evidence();
REVOKE ALL ON zc_private.level_version_lineage,zc_private.record_validation,zc_private.record_run FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT FROM pg_roles WHERE rolname='zeepcentraal_graphql') THEN
REVOKE ALL ON zc_private.level_version_lineage,zc_private.record_validation,zc_private.record_run FROM zeepcentraal_graphql;
END IF; END $$;
